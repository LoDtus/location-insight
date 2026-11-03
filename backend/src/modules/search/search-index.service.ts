import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BulkOperation,
  ElasticsearchIntegrationService,
} from '../../integrations/elasticsearch/elasticsearch.service.js';
import { buildIndexDefinition, SYNONYM_SET_ID } from './search-analysis.js';
import {
  aliasName,
  indexCandidates,
  parseIndexVersion,
} from './search-names.js';
import {
  SearchRegistry,
  type AnySearchProfile,
} from './search-registry.service.js';
import { VI_COMMON_SYNONYMS } from './search-synonyms.js';

const BATCH = 1000;
/** Lùi mốc khi bù thay đổi để không sót bản ghi sửa ngay lúc bắt đầu (lệch đồng hồ, giao dịch dài). */
const COMPENSATE_SKEW_MS = 60_000;

export type ReindexOutcome = 'done' | 'busy' | 'skipped';

@Injectable()
export class SearchIndexService implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexService.name);
  private synonymsApplied = false;

  constructor(
    private readonly es: ElasticsearchIntegrationService,
    private readonly registry: SearchRegistry,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.es.onReady(
      () =>
        void this.prepare().catch((e: unknown) =>
          this.logFailure('chuẩn bị', e),
        ),
    );
    this.registry.onRegister((profile) => {
      if (this.es.isReady()) {
        void this.ensure(profile).catch((e: unknown) =>
          this.logFailure(profile.name, e),
        );
      }
    });
  }

  /** Áp dụng từ đồng nghĩa (phải có trước khi tạo index), rồi bảo đảm index của mọi profile đã bật. */
  private async prepare(): Promise<void> {
    await this.applySynonyms();
    for (const profile of this.registry.all()) {
      await this.ensure(profile).catch((e: unknown) =>
        this.logFailure(profile.name, e),
      );
    }
  }

  async applySynonyms(): Promise<void> {
    await this.es.putSynonymSet(SYNONYM_SET_ID, [...VI_COMMON_SYNONYMS]);
    this.synonymsApplied = true;
    this.logger.log(
      `Đã áp dụng bộ từ đồng nghĩa "${SYNONYM_SET_ID}" (${VI_COMMON_SYNONYMS.length} quy tắc)`,
    );
  }

  /**
   * Bảo đảm alias của profile tồn tại và đúng phiên bản. Chưa có alias hoặc phiên bản thấp hơn
   * thì dựng lại ở nền (FR-09). Chỉ chạy cho profile đã bật.
   */
  async ensure(profile: AnySearchProfile): Promise<void> {
    if (!this.es.isReady() || !this.es.settings.profiles.has(profile.name))
      return;
    if (!this.synonymsApplied) await this.applySynonyms();

    const alias = aliasName(this.es.settings.indexPrefix, profile.name);
    const targets = await this.es.resolveAlias(alias);
    const current = targets[0] ? parseIndexVersion(targets[0]) : null;
    if (current !== null && current >= profile.version) return;

    this.logger.log(
      targets.length === 0
        ? `Chưa có index cho "${profile.name}", dựng lần đầu`
        : `Phiên bản index của "${profile.name}" cũ (${current ?? '?'} < ${profile.version}), dựng lại`,
    );
    void this.reindex(profile).catch((e: unknown) =>
      this.logFailure(profile.name, e),
    );
  }

  /**
   * Dựng lại không gián đoạn (FR-09): tạo index mới → nạp từ PostgreSQL → bù thay đổi trong lúc nạp →
   * đổi alias nguyên tử. Index trước đó được giữ lại để quay lui. Một khóa tư vấn PostgreSQL ngăn hai
   * instance dựng cùng lúc.
   */
  async reindex(profile: AnySearchProfile): Promise<ReindexOutcome> {
    if (!this.es.isReady()) return 'skipped';

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    const lockKey = `search-reindex:${this.es.settings.indexPrefix}${profile.name}`;
    try {
      const rows: Array<{ locked: boolean }> = await runner.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
        [lockKey],
      );
      if (!rows[0]?.locked) return 'busy';
      try {
        await this.rebuild(profile);
        return 'done';
      } finally {
        await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [
          lockKey,
        ]);
      }
    } finally {
      await runner.release();
    }
  }

  private async rebuild(profile: AnySearchProfile): Promise<void> {
    const alias = aliasName(this.es.settings.indexPrefix, profile.name);
    const current = await this.es.resolveAlias(alias);
    const [first, second] = indexCandidates(
      this.es.settings.indexPrefix,
      profile.name,
      profile.version,
    );
    const target = current.includes(first) ? second : first;

    // Bản dựng dở hoặc index cũ nhất còn sót lại cùng tên: bỏ để dựng sạch.
    await this.es.deleteIndex(target);
    const definition = buildIndexDefinition(profile);
    await this.es.createIndex(target, definition.mappings, definition.settings);

    const startedAt = new Date();
    const loaded = await this.copyAll(profile, target);
    const compensated = await this.copyAll(
      profile,
      target,
      new Date(startedAt.getTime() - COMPENSATE_SKEW_MS),
    );
    await this.es.refresh(target);

    await this.es.swapAlias(alias, target, current);
    this.logger.log(
      `Đã dựng "${profile.name}" → ${target}: ${loaded} tài liệu, bù ${compensated} thay đổi; index trước giữ lại: ${current.join(', ') || 'không có'}`,
    );
  }

  /** Nạp từ PostgreSQL theo lô keyset vào index đích; trả số tài liệu đã ghi. */
  private async copyAll(
    profile: AnySearchProfile,
    index: string,
    since?: Date,
  ): Promise<number> {
    let afterId: string | null = null;
    let written = 0;
    for (;;) {
      const rows = await profile.loadBatch(afterId, BATCH, since);
      if (rows.length === 0) return written;

      const operations: BulkOperation[] = rows.flatMap((row) => {
        const id = profile.idOf(row);
        const document = profile.toDocument(row);
        return document === null
          ? []
          : [{ id, document: { ...document, docId: id } }];
      });
      const failed = await this.es.bulk(index, operations);
      if (failed.length > 0) {
        throw new Error(
          `Bulk lỗi ${failed.length} tài liệu khi dựng "${profile.name}"`,
        );
      }
      written += operations.length;
      const last = rows[rows.length - 1];
      afterId = last === undefined ? null : profile.idOf(last);
      if (rows.length < BATCH) return written;
    }
  }

  private logFailure(scope: string, error: unknown): void {
    this.logger.error(
      `Search index "${scope}" lỗi: ${error instanceof Error ? `${error.name}: ${error.message}` : 'không rõ'}`,
    );
  }
}
