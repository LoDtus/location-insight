import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { EmailConfig } from './email.config.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string | null;
}

/** Giao diện nhà cung cấp. Thêm SES/Postmark API = thêm một lớp triển khai. */
export interface MailTransport {
  send(mail: OutgoingMail): Promise<{ messageId: string | null }>;
  close(): void;
}

export interface SendFailure {
  permanent: boolean;
  /** Địa chỉ không tồn tại → đưa vào danh sách chặn. */
  hardBounce: boolean;
  message: string;
}

export function classifyError(error: unknown): SendFailure {
  const e = error as { code?: string; responseCode?: number; response?: string; message?: string };
  const message = String(e?.message ?? error).slice(0, 480);
  const code = e?.responseCode ?? 0;
  const response = e?.response ?? '';
  const config = e?.code === 'EAUTH' || e?.code === 'ECONNECTION' || e?.code === 'ETIMEDOUT';
  const permanent = !config && (code >= 500 || e?.code === 'EENVELOPE');
  const hardBounce =
    permanent &&
    [550, 551, 553].includes(code) &&
    /5\.1\.[1-6]|unknown|no such|not exist|invalid|unavailable/i.test(response);
  return { permanent, hardBounce, message };
}

export class SmtpTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(private readonly config: EmailConfig) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTls,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }

  async send(mail: OutgoingMail): Promise<{ messageId: string | null }> {
    const info = (await this.transporter.sendMail({
      from: { name: this.config.fromName, address: this.config.fromAddress },
      replyTo: this.config.replyTo,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: mail.unsubscribeUrl
        ? {
            'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
      // Không nhúng ảnh/URL từ xa tự động; không tự đọc tệp cục bộ.
      disableFileAccess: true,
      disableUrlAccess: true,
    })) as { messageId?: string };
    return { messageId: info.messageId ?? null };
  }

  close(): void {
    this.transporter.close();
  }
}

/** Dev không có SMTP: chỉ ghi log (không in nội dung ở production). */
export class LogTransport implements MailTransport {
  private readonly logger = new Logger('Mail');

  async send(mail: OutgoingMail): Promise<{ messageId: string | null }> {
    this.logger.log(`to=${mail.to} subject="${mail.subject}"`);
    if (process.env.NODE_ENV !== 'production') this.logger.debug(`\n${mail.text}`);
    return { messageId: null };
  }

  close(): void {
    /* không có tài nguyên */
  }
}
