import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BulkOperation,
  ElasticsearchIntegrationService,
} from '../../integrations/elasticsearch/elasticsearch.service.js';
import { rowsOf } from '../messaging/messaging-db.js';
import { aliasName } from './search-names.js';
import {
  SearchRegistry,
  type AnySearchProfile,
} from './search-registry.service.js';

const LEASE_SECONDS = 60;
const MAX_ATTEMPTS = 8;

interface Claimed {
  id: string;
  profile: string;
  doc_id: string;
  revision: string;
}

/**
 * Worker đồng bộ outbox → ES, chạy trong tiến trình backend (như email-worker).
 * `FOR UPDATE SKIP LOCKED` để chạy được trên nhiều instance. Luôn đọc TRẠNG THÁI HIỆN TẠI từ PostgreSQL
 * nên tự khử trùng lặp và đảo thứ tự (FR-08).
 */
@Injectable()
export class SearchWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private readonly es: ElasticsearchIntegrationService,
    private readonly registry: SearchRegistry,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    if (!this.es.isEnabled()) return;
    this.schedule();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    for (let i = 0; i < 100 && this.running; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private schedule(): void {
    this.timer = setTimeout(
      () => void this.tick(),
      this.es.settings.syncIntervalMs,
    );
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    this.running = true;
    let more = false;
    try {
      // Chưa có profile bật hoặc ES chưa sẵn sàng thì không đụng vào outbox.
      if (this.es.isReady() && this.es.settings.profiles.size > 0) {
        more = (await this.runOnce()) >= this.es.settings.syncBatch;
      }
    } catch (error) {
      this.logger.error(
        `Worker search lỗi: ${error instanceof Error ? error.name : 'không rõ'}`,
      );
    } finally {
      this.running = false;
    }
    if (this.stopped) return;
    if (more) {
      this.timer = setTimeout(() => void this.tick(), 0);
      this.timer.unref();
    } else {
      this.schedule();
    }
  }

  /** Xử lý một lô; trả số dòng đã nhận. */
  async runOnce(): Promise<number> {
    const claimed = await this.claim(this.es.settings.syncBatch);
    const byProfile = new Map<string, Claimed[]>();
    for (const row of claimed) {
      const list = byProfile.get(row.profile) ?? [];
      list.push(row);
      byProfile.set(row.profile, list);
    }
    for (const [name, rows] of byProfile) {
      await this.processProfile(name, rows);
    }
    return claimed.length;
  }

  private async processProfile(name: string, rows: Claimed[]): Promise<void> {
    const profile = this.registry.get(name);
    if (!profile || !this.es.settings.profiles.has(name)) {
      await this.fail(rows, 'profile-unavailable', true);
      return;
    }
    try {
      const failedIds = await this.apply(profile, rows);
      const failed = rows.filter((row) => failedIds.has(row.doc_id));
      const done = rows.filter((row) => !failedIds.has(row.doc_id));
      await this.complete(done);
      if (failed.length > 0) await this.fail(failed, 'bulk-item-error', false);
    } catch (error) {
      await this.fail(
        rows,
        error instanceof Error ? error.name : 'unknown',
        false,
      );
    }
  }

  /** Ghi hoặc xóa theo trạng thái hiện tại; trả các doc_id thất bại. */
  private async apply(
    profile: AnySearchProfile,
    rows: Claimed[],
  ): Promise<Set<string>> {
    const current = await profile.loadByIds(rows.map((row) => row.doc_id));
    const byId = new Map(current.map((row) => [profile.idOf(row), row]));

    const operations: BulkOperation[] = rows.map((claimed) => {
      const row = byId.get(claimed.doc_id);
      const document = row === undefined ? null : profile.toDocument(row);
      return {
        id: claimed.doc_id,
        document:
          document === null ? null : { ...document, docId: claimed.doc_id },
      };
    });
    const alias = aliasName(this.es.settings.indexPrefix, profile.name);
    return new Set(await this.es.bulk(alias, operations));
  }

  private async claim(limit: number): Promise<Claimed[]> {
    return rowsOf<Claimed>(
      await this.dataSource.query(
        `UPDATE search_outbox
            SET status = 'processing', attempts = attempts + 1,
                next_attempt_at = now() + make_interval(secs => $2), updated_at = now()
          WHERE id IN (
            SELECT id FROM search_outbox
             WHERE status IN ('pending', 'processing') AND next_attempt_at <= now()
             ORDER BY id
             LIMIT $1
             FOR UPDATE SKIP LOCKED)
          RETURNING id, profile, doc_id, revision`,
        [limit, LEASE_SECONDS],
      ),
    );
  }

  /** Xóa đúng revision đã xử lý; dòng đã bị ghi đè bởi thay đổi mới hơn được giữ lại. */
  private async complete(rows: Claimed[]): Promise<void> {
    if (rows.length === 0) return;
    await this.dataSource.query(
      `DELETE FROM search_outbox o
        USING unnest($1::bigint[], $2::bigint[]) AS t(id, revision)
        WHERE o.id = t.id AND o.revision = t.revision`,
      [rows.map((row) => row.id), rows.map((row) => row.revision)],
    );
  }

  /** Lùi theo cấp số nhân (tối đa 5 phút); quá MAX_ATTEMPTS hoặc `terminal` thì chuyển dead. */
  private async fail(
    rows: Claimed[],
    reason: string,
    terminal: boolean,
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.dataSource.query(
      `UPDATE search_outbox o
          SET status = CASE WHEN $3 OR o.attempts >= $4 THEN 'dead' ELSE 'pending' END,
              next_attempt_at = now() + make_interval(secs => LEAST(power(2, o.attempts), 300)),
              last_error = $5, updated_at = now()
         FROM unnest($1::bigint[], $2::bigint[]) AS t(id, revision)
        WHERE o.id = t.id AND o.revision = t.revision`,
      [
        rows.map((row) => row.id),
        rows.map((row) => row.revision),
        terminal,
        MAX_ATTEMPTS,
        reason.slice(0, 200),
      ],
    );
    this.logger.warn(`Outbox search: ${rows.length} dòng lỗi (${reason})`);
  }
}
