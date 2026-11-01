import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { rowsOf } from '../messaging/messaging-db.js';
import { EmailConfig } from './email.config.js';
import { EMAIL_LIMITS } from './email.constants.js';
import { EmailService } from './email.service.js';
import {
  classifyError,
  LogTransport,
  MailTransport,
  SmtpTransport,
} from './email-transport.js';

interface Claimed {
  id: string;
  to_email: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  unsubscribe_url: string | null;
  attempts: number;
  sensitive: boolean;
}

@Injectable()
export class EmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorkerService.name);
  private transport: MailTransport | null = null;
  private timer: NodeJS.Timeout | null = null;
  private cleanTimer: NodeJS.Timeout | null = null;
  private running = false;
  private again = false;
  private stopped = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: EmailConfig,
    private readonly email: EmailService,
  ) {}

  onModuleInit(): void {
    if (!this.config.workerEnabled) return;
    this.transport = this.config.driver === 'smtp' ? new SmtpTransport(this.config) : new LogTransport();
    this.logger.log(`Worker email bật (driver=${this.config.driver})`);
    this.email.onEnqueued(() => this.kick());
    this.schedule(EMAIL_LIMITS.pollMs);
    this.cleanTimer = setInterval(() => void this.cleanup().catch(() => undefined), 60 * 60 * 1000);
    this.cleanTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.cleanTimer) clearInterval(this.cleanTimer);
    // đợi lượt đang chạy xong (tối đa 10 giây)
    for (let i = 0; i < 100 && this.running; i += 1) await new Promise((r) => setTimeout(r, 100));
    this.transport?.close();
  }

  kick(): void {
    if (this.stopped || !this.transport) return;
    if (this.running) {
      this.again = true;
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.schedule(0);
  }

  private schedule(ms: number): void {
    this.timer = setTimeout(() => void this.tick(), ms);
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    this.running = true;
    let more = false;
    try {
      more = (await this.runOnce()) >= EMAIL_LIMITS.batch;
    } catch (error) {
      this.logger.error(`Worker email lỗi: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
    const next = more || this.again;
    this.again = false;
    this.schedule(next ? 0 : EMAIL_LIMITS.pollMs);
  }

  /** Nhận và gửi một lô. Trả về số dòng đã nhận. Công khai để test và bảo trì gọi. */
  async runOnce(): Promise<number> {
    const claimed = await this.claim(EMAIL_LIMITS.batch);
    let index = 0;
    const lanes = Array.from({ length: Math.min(EMAIL_LIMITS.concurrency, claimed.length) }, async () => {
      while (index < claimed.length) {
        const row = claimed[index];
        index += 1;
        await this.deliver(row);
      }
    });
    await Promise.all(lanes);
    return claimed.length;
  }

  private async claim(limit: number): Promise<Claimed[]> {
    return rowsOf<Claimed>(
      await this.dataSource.query(
        `UPDATE email_messages
            SET status = 'sending', attempts = attempts + 1,
                next_attempt_at = now() + make_interval(secs => $2), updated_at = now()
          WHERE id IN (
            SELECT id FROM email_messages
             WHERE status IN ('queued','sending') AND next_attempt_at <= now()
             ORDER BY next_attempt_at
             LIMIT $1
             FOR UPDATE SKIP LOCKED)
          RETURNING id, to_email, subject, body_html, body_text, unsubscribe_url, attempts, sensitive`,
        [limit, EMAIL_LIMITS.leaseSeconds],
      ),
    );
  }

  private async deliver(row: Claimed): Promise<void> {
    if (row.attempts > EMAIL_LIMITS.maxAttempts || !row.body_html) {
      await this.finish(row, 'dead', row.body_html ? 'Hết lượt gửi (lease hết hạn)' : 'Không còn nội dung để gửi');
      return;
    }
    try {
      const result = await this.transport!.send({
        to: row.to_email,
        subject: row.subject,
        html: row.body_html,
        text: row.body_text ?? '',
        unsubscribeUrl: row.unsubscribe_url,
      });
      await this.dataSource.query(
        `UPDATE email_messages
            SET status = 'sent', sent_at = now(), provider_message_id = $2, last_error = NULL,
                body_html = CASE WHEN sensitive THEN NULL ELSE body_html END,
                body_text = CASE WHEN sensitive THEN NULL ELSE body_text END,
                updated_at = now()
          WHERE id = $1 AND status = 'sending'`,
        [row.id, result.messageId?.slice(0, 200) ?? null],
      );
    } catch (error) {
      const failure = classifyError(error);
      this.logger.warn(`Gửi email ${row.id} lần ${row.attempts} lỗi: ${failure.message}`);
      if (failure.hardBounce) {
        await this.dataSource.query(
          `INSERT INTO email_suppressions (email, reason, note, created_at)
           VALUES ($1, 'hard_bounce', $2, now()) ON CONFLICT (email) DO NOTHING`,
          [row.to_email, failure.message.slice(0, 200)],
        );
      }
      if (failure.permanent || row.attempts >= EMAIL_LIMITS.maxAttempts) {
        await this.finish(row, 'dead', failure.message);
        return;
      }
      const delay = EMAIL_LIMITS.backoffSeconds[Math.min(row.attempts - 1, EMAIL_LIMITS.backoffSeconds.length - 1)];
      await this.dataSource.query(
        `UPDATE email_messages
            SET status = 'queued', last_error = $2,
                next_attempt_at = now() + make_interval(secs => $3), updated_at = now()
          WHERE id = $1 AND status = 'sending'`,
        [row.id, failure.message, delay],
      );
    }
  }

  private async finish(row: Claimed, status: 'dead', reason: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE email_messages
          SET status = $2, last_error = $3,
              body_html = CASE WHEN sensitive THEN NULL ELSE body_html END,
              body_text = CASE WHEN sensitive THEN NULL ELSE body_text END,
              updated_at = now()
        WHERE id = $1 AND status = 'sending'`,
      [row.id, status, reason.slice(0, 500)],
    );
  }

  async cleanup(): Promise<void> {
    await this.dataSource.query(
      `UPDATE email_messages SET body_html = NULL, body_text = NULL, updated_at = now()
        WHERE body_html IS NOT NULL AND status IN ('sent','skipped','suppressed')
          AND created_at < now() - make_interval(days => $1)`,
      [EMAIL_LIMITS.contentRetentionDays],
    );
    await this.dataSource.query(
      `DELETE FROM email_messages WHERE created_at < now() - make_interval(days => $1)
        AND status NOT IN ('queued','sending')`,
      [EMAIL_LIMITS.rowRetentionDays],
    );
  }
}
