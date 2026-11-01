import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailConfig {
  constructor(private readonly config: ConfigService) {}

  private str(name: string, fallback = ''): string {
    return this.config.get<string>(name) || fallback;
  }

  get driver(): 'smtp' | 'log' {
    const explicit = this.str('MAIL_DRIVER');
    if (explicit === 'smtp' || explicit === 'log') return explicit;
    return this.host ? 'smtp' : 'log';
  }
  get host(): string {
    return this.str('MAIL_HOST');
  }
  get port(): number {
    return Number(this.str('MAIL_PORT', '587'));
  }
  /** true = TLS ngay khi nối (cổng 465); false = STARTTLS nếu server hỗ trợ. */
  get secure(): boolean {
    return this.str('MAIL_SECURE') === 'true';
  }
  /** Bắt buộc STARTTLS (false cho Mailpit dev). */
  get requireTls(): boolean {
    return this.str('MAIL_REQUIRE_TLS', process.env.NODE_ENV === 'production' ? 'true' : 'false') === 'true';
  }
  get user(): string {
    return this.str('MAIL_USER');
  }
  get password(): string {
    return this.str('MAIL_PASSWORD');
  }
  get fromAddress(): string {
    return this.str('MAIL_FROM_ADDRESS', 'no-reply@localhost');
  }
  get fromName(): string {
    return this.str('MAIL_FROM_NAME', this.appName);
  }
  get replyTo(): string | undefined {
    return this.str('MAIL_REPLY_TO') || undefined;
  }
  get appName(): string {
    return this.str('MAIL_APP_NAME', 'Địa Thế');
  }
  get supportEmail(): string {
    return this.str('MAIL_SUPPORT_EMAIL', this.fromAddress);
  }
  get appUrl(): string {
    const first = this.str('AUTH_ALLOWED_ORIGINS').split(',')[0]?.trim();
    return (this.str('APP_PUBLIC_URL') || first || 'http://127.0.0.1:22360').replace(/\/+$/, '');
  }
  get workerEnabled(): boolean {
    return this.str('MAIL_WORKER_ENABLED') !== 'false';
  }
  /** Khóa ký liên kết hủy đăng ký. Production không có khóa → không gửi loại có hủy đăng ký. */
  get linkSecret(): string | null {
    const secret = this.str('EMAIL_LINK_SECRET');
    if (secret.length >= 16) return secret;
    return process.env.NODE_ENV === 'production' ? null : 'dev-only-email-link-secret';
  }
}
