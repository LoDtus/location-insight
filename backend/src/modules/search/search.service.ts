import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ElasticsearchIntegrationService } from '../../integrations/elasticsearch/elasticsearch.service.js';
import { CircuitBreaker } from './search-circuit.js';
import { aliasName } from './search-names.js';
import {
  DEFAULT_SCORE_RATIO_MIN,
  applyScoreCutoff,
  buildSearchRequest,
  type ScoredHit,
} from './search-query.js';
import { clampPage, normalizeQuery } from './search-text.js';
import type { SearchOutboxOp } from './entities/search-outbox.entity.js';
import type {
  SearchProfile,
  SearchRequest,
  SearchResult,
} from './search.types.js';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly breaker = new CircuitBreaker();

  constructor(
    private readonly es: ElasticsearchIntegrationService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Tìm theo chữ. Trả `null` khi KHÔNG nên dùng ES (không có `q`, `q` quá ngắn, ES tắt, profile chưa bật):
   * người gọi chạy luồng PostgreSQL bình thường (FR-01). Khi ES được dùng nhưng không khả dụng, trả kết quả
   * dự phòng từ PostgreSQL với `degraded = true` (FR-10). Lỗi ES không bao giờ ném ra ngoài.
   */
  async search<TRow, TFilters>(
    profile: SearchProfile<TRow, TFilters>,
    request: SearchRequest<TFilters>,
  ): Promise<SearchResult<TRow> | null> {
    const q = normalizeQuery(request.q);
    if (q === null) return null;
    if (!this.isProfileEnabled(profile.name)) return null;

    const page = clampPage(request.page);
    const normalized: SearchRequest<TFilters> = { ...request, q, page };

    if (!this.es.isReady() || !this.breaker.canRequest()) {
      return this.fromDatabase(profile, normalized, 'unavailable');
    }

    try {
      const result = await this.fromElasticsearch(profile, normalized, q);
      this.breaker.recordSuccess();
      return result;
    } catch (error) {
      this.breaker.recordFailure();
      this.logger.warn(
        `ES lỗi khi tìm "${profile.name}" (độ dài q=${q.length}): ${errorName(error)}`,
      );
      return this.fromDatabase(profile, normalized, 'error');
    }
  }

  /**
   * Ghi dòng outbox trong CÙNG giao dịch với thay đổi bản ghi. Gộp theo (profile, doc_id).
   * Bỏ qua khi profile chưa bật: bật profile phải đi kèm dựng index đầy đủ (FR-09).
   */
  async enqueue(
    profile: Pick<SearchProfile<unknown, unknown>, 'name'>,
    id: string,
    op: SearchOutboxOp,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    if (!this.isProfileEnabled(profile.name)) return;
    await manager.query(
      `INSERT INTO search_outbox (profile, doc_id, op, status, attempts, revision, next_attempt_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', 0, 1, now(), now(), now())
       ON CONFLICT (profile, doc_id) DO UPDATE
         SET op = EXCLUDED.op,
             status = 'pending',
             attempts = 0,
             revision = search_outbox.revision + 1,
             next_attempt_at = now(),
             last_error = NULL,
             updated_at = now()`,
      [profile.name, id, op],
    );
  }

  isProfileEnabled(name: string): boolean {
    return this.es.isEnabled() && this.es.settings.profiles.has(name);
  }

  private async fromElasticsearch<TRow, TFilters>(
    profile: SearchProfile<TRow, TFilters>,
    request: SearchRequest<TFilters>,
    q: string,
  ): Promise<SearchResult<TRow>> {
    const alias = aliasName(this.es.settings.indexPrefix, profile.name);
    const response = await this.es.searchWithTimeout(
      buildSearchRequest({
        index: alias,
        profile,
        q,
        filters: profile.toFilters(request.filters, request.viewer),
        page: request.page,
        sort: request.sort,
      }),
      this.es.settings.searchTimeoutMs,
    );

    const hits: ScoredHit[] = response.hits.hits.flatMap((hit) =>
      hit._id ? [{ id: hit._id, score: hit._score ?? null }] : [],
    );
    const kept = applyScoreCutoff(
      hits,
      profile.scoreRatioMin ?? DEFAULT_SCORE_RATIO_MIN,
    );
    return this.hydrate(profile, request, kept);
  }

  /** Đọc bản ghi từ PostgreSQL theo thứ tự của ES; kiểm quyền một lần nữa; dọn id đã mất (FR-07). */
  private async hydrate<TRow, TFilters>(
    profile: SearchProfile<TRow, TFilters>,
    request: SearchRequest<TFilters>,
    hits: readonly ScoredHit[],
  ): Promise<SearchResult<TRow>> {
    const rows = await profile.loadByIds(hits.map((hit) => hit.id));
    const byId = new Map(rows.map((row) => [profile.idOf(row), row]));

    const items: SearchResult<TRow>['items'] = [];
    for (const hit of hits) {
      const row = byId.get(hit.id);
      if (row === undefined) {
        // Bản ghi không còn trong PostgreSQL: ES đang giữ bản cũ, dọn nó.
        await this.enqueue(profile, hit.id, 'delete').catch(() => undefined);
        continue;
      }
      if (profile.canView(row, request.viewer))
        items.push({ row, score: hit.score });
    }
    return { items, source: 'elasticsearch', degraded: false };
  }

  private async fromDatabase<TRow, TFilters>(
    profile: SearchProfile<TRow, TFilters>,
    request: SearchRequest<TFilters>,
    reason: 'unavailable' | 'error',
  ): Promise<SearchResult<TRow>> {
    this.logger.debug(`Tìm "${profile.name}" dùng PostgreSQL (${reason})`);
    const rows = await profile.fallback(request);
    return {
      items: rows.map((row) => ({ row, score: null })),
      source: 'database',
      degraded: true,
    };
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'lỗi không rõ';
}
