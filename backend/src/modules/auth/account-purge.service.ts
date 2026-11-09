import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AUTH_LOG_RETENTION_MONTHS,
  anonymizedEmail,
  purgeCutoff,
} from './account-retention.js';

const HOUR_MS = 60 * 60 * 1000;
const BATCH = 50;

/**
 * Thực hiện cam kết trong Chính sách bảo mật: sau 30 ngày kể từ khi xóa tài khoản,
 * hồ sơ và thông tin đăng nhập bị ẩn danh hoặc xóa; nhật ký xác thực giữ tối đa 12 tháng.
 * Đơn hàng và chứng từ thanh toán được giữ theo luật kế toán, thuế nên không đụng tới.
 */
@Injectable()
export class AccountPurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountPurgeService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.run().catch((error: unknown) => {
        this.logger.warn(`Dọn dữ liệu tài khoản đã xóa lỗi: ${String(error)}`);
      });
    }, HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<{ anonymized: number }> {
    const anonymized = await this.anonymizeDeletedUsers(now);
    const logCutoff = new Date(now);
    logCutoff.setMonth(logCutoff.getMonth() - AUTH_LOG_RETENTION_MONTHS);
    await this.dataSource.query(`DELETE FROM auth_events WHERE created_at < $1`, [
      logCutoff,
    ]);
    return { anonymized };
  }

  private async anonymizeDeletedUsers(now: Date): Promise<number> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM users
        WHERE status = 'deleted'
          AND deleted_at IS NOT NULL
          AND deleted_at < $1
          AND email NOT LIKE 'deleted-%@deleted.invalid'
        LIMIT ${BATCH}`,
      [purgeCutoff(now)],
    );
    for (const { id } of rows) {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `UPDATE users
              SET email = $2,
                  display_name = 'Người dùng đã xóa',
                  avatar_url = NULL,
                  username = NULL,
                  city = NULL,
                  bio = '',
                  password_hash = NULL,
                  email_verified_at = NULL
            WHERE id = $1`,
          [id, anonymizedEmail(id)],
        );
        await manager.query(`DELETE FROM auth_identities WHERE user_id = $1`, [id]);
        await manager.query(`DELETE FROM auth_one_time_tokens WHERE user_id = $1`, [id]);
        await manager.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [id]);
        await manager.query(
          `UPDATE auth_events SET ip_address = NULL, user_agent = NULL, meta = NULL
            WHERE user_id = $1`,
          [id],
        );
      });
    }
    return rows.length;
  }
}
