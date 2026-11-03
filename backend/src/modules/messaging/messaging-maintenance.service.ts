import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { rowsOf } from './messaging-db.js';
import { MessagingHistoryService } from './messaging-history.service.js';
import { MESSAGING_KEYS } from './messaging.constants.js';

const HOUR = 60 * 60 * 1000;

/**
 * Dọn dẹp mỗi giờ, một instance chạy tại một thời điểm (khóa Redis):
 *  - ảnh pending quá 24 giờ, ảnh của tin đã thu hồi quá 7 ngày (trừ tin có báo cáo mở);
 *  - hội thoại rỗng quá 24 giờ;
 *  - hội thoại mà cả hai phía đã xóa quá 30 ngày;
 *  - báo cáo đã xử lý quá 180 ngày;
 *  - yêu cầu xóa lịch sử hai phía quá 7 ngày không ai trả lời.
 */
@Injectable()
export class MessagingMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MessagingMaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly history: MessagingHistoryService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.run();
    }, HOUR);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      const lock = await this.redis
        .getClient()
        .set(MESSAGING_KEYS.maintenanceLock, '1', 'EX', 55 * 60, 'NX');
      if (lock !== 'OK') return;
      await this.cleanAttachments();
      await this.cleanConversations();
      await this.history.expireStale();
      await this.dataSource.query(
        `DELETE FROM message_reports WHERE status <> 'open' AND resolved_at < now() - interval '180 days'`,
      );
    } catch (error) {
      this.logger.warn(
        `Dọn nhắn tin lỗi: ${error instanceof Error ? error.message : 'không rõ'}`,
      );
    }
  }

  private async cleanAttachments(): Promise<void> {
    const stale = rowsOf<{ id: string; object_key: string }>(
      await this.dataSource.query(
        `SELECT a.id, a.object_key FROM message_attachments a
         WHERE (a.status IN ('pending', 'rejected') AND a.created_at < now() - interval '24 hours')
            OR (a.message_seq IS NOT NULL AND EXISTS (
                 SELECT 1 FROM messages m
                 WHERE m.conversation_id = a.conversation_id AND m.seq = a.message_seq
                   AND m.status = 'deleted' AND m.deleted_at < now() - interval '7 days')
                 AND NOT EXISTS (
                 SELECT 1 FROM message_reports r
                 WHERE r.conversation_id = a.conversation_id AND r.message_seq = a.message_seq))
         LIMIT 200`,
      ),
    );
    for (const row of stale) {
      await this.storage.deleteObject(row.object_key).catch(() => undefined);
      await this.dataSource.query(
        `DELETE FROM message_attachments WHERE id = $1`,
        [row.id],
      );
    }
  }

  private async cleanConversations(): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM conversations WHERE last_seq = 0 AND created_at < now() - interval '24 hours'`,
    );
    const gone = rowsOf<{ id: string }>(
      await this.dataSource.query(
        `SELECT c.id FROM conversations c
         WHERE c.last_seq > 0
           AND NOT EXISTS (
             SELECT 1 FROM conversation_participants p
             WHERE p.conversation_id = c.id AND p.left_at IS NULL
               AND (p.hidden_at IS NULL OR p.hidden_at > now() - interval '30 days'))
         LIMIT 50`,
      ),
    );
    for (const { id } of gone) {
      const files = rowsOf<{ object_key: string }>(
        await this.dataSource.query(
          `SELECT object_key FROM message_attachments WHERE conversation_id = $1`,
          [id],
        ),
      );
      for (const file of files)
        await this.storage.deleteObject(file.object_key).catch(() => undefined);
      await this.dataSource.query(`DELETE FROM conversations WHERE id = $1`, [
        id,
      ]);
    }
  }
}
