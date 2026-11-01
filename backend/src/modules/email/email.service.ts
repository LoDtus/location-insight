import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { rowsOf } from '../messaging/messaging-db.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import {
  allVariables,
  findTemplate,
  TemplateDefinition,
} from './email.catalog.js';
import { EmailConfig } from './email.config.js';
import {
  DEFAULT_LOCALE,
  EMAIL_LIMITS,
  EMAIL_LOCALES,
  EmailCategory,
  EmailStatus,
  OPTIONAL_CATEGORIES,
  OptionalCategory,
} from './email.constants.js';
import { signUnsubscribe, verifyUnsubscribe } from './email-links.js';
import { renderEmail } from './email-render.js';
import { EmailPreferenceEntity } from './entities/email-preference.entity.js';
import { EmailTemplateEntity } from './entities/email-template.entity.js';

export interface SendEmailInput {
  template: string;
  to: { userId?: string | null; email: string; displayName?: string; locale?: string | null };
  vars?: Record<string, string>;
  /** Cùng khóa gọi nhiều lần chỉ tạo một email. */
  dedupeKey?: string;
  /** Gửi thử của admin: bỏ qua tùy chọn người dùng và dedupe. */
  test?: boolean;
}

export interface EffectiveTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  enabled: boolean;
  customized: boolean;
  version: number;
  locale: string;
}

const CACHE_MS = 30_000;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly cache = new Map<string, { at: number; row: EmailTemplateEntity | null }>();
  private kickHandler: (() => void) | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly config: EmailConfig,
    @InjectRepository(EmailTemplateEntity) private readonly templates: Repository<EmailTemplateEntity>,
    @InjectRepository(EmailPreferenceEntity) private readonly prefs: Repository<EmailPreferenceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  /** Worker đăng ký để được đánh thức ngay sau khi xếp hàng. */
  onEnqueued(handler: () => void): void {
    this.kickHandler = handler;
  }

  /** Gửi không chặn và không bao giờ ném lỗi: sự cố email không được làm hỏng nghiệp vụ. */
  async send(input: SendEmailInput): Promise<void> {
    try {
      await this.enqueue(input);
    } catch (error) {
      this.logger.error(
        `Không xếp hàng được email ${input.template}: ${(error as Error).message}`,
      );
    }
  }

  /** Trả về `id` và trạng thái để API gửi thử có thể báo lại. */
  async enqueue(input: SendEmailInput): Promise<{ id: string; status: EmailStatus } | null> {
    const def = findTemplate(input.template);
    if (!def) throw new Error(`Loại email không tồn tại: ${input.template}`);
    const email = input.to.email.trim().toLowerCase();
    if (!email || email.length > 320 || /[\s,;<>]/.test(email)) return null;

    const locale = this.pickLocale(input.to.locale);
    const id = uuidv7();
    const base = { id, def, email, locale, userId: input.to.userId ?? null, dedupeKey: input.dedupeKey ?? null };

    if (await this.isSuppressed(email)) {
      return this.record(base, 'suppressed', 'Địa chỉ nằm trong danh sách chặn');
    }
    const template = await this.effective(def.key, locale);
    if (!template.enabled && def.category !== 'security') {
      return this.record(base, 'skipped', 'Loại email đã bị tắt');
    }
    if (!input.test && !(await this.allowedByPreference(def.category, base.userId))) {
      return this.record(base, 'skipped', 'Người dùng đã tắt loại email này');
    }
    if (!input.test && !(await this.withinRate(email, def))) {
      return this.record(base, 'skipped', 'Vượt giới hạn tần suất gửi');
    }

    let unsubscribeUrl: string | null = null;
    if ((OPTIONAL_CATEGORIES as readonly string[]).includes(def.category)) {
      unsubscribeUrl = this.unsubscribeUrl(base.userId, def.category as OptionalCategory);
      if (!unsubscribeUrl && !input.test) {
        return this.record(base, 'skipped', 'Chưa cấu hình khóa liên kết hủy đăng ký');
      }
    }

    const values = this.values(def, input);
    const rendered = renderEmail({
      def,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      values,
      unsubscribeUrl: unsubscribeUrl ? this.unsubscribePageUrl(unsubscribeUrl) : null,
    });
    const subject = input.test ? `[Thử] ${rendered.subject}` : rendered.subject;

    const rows = rowsOf<{ id: string }>(
      await this.dataSource.query(
        `INSERT INTO email_messages
           (id, template_key, category, locale, user_id, to_email, subject, body_html, body_text,
            unsubscribe_url, sensitive, status, attempts, next_attempt_at, dedupe_key,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'queued',0,now(),$12,now(),now())
         ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          id, def.key, def.category, locale, base.userId, email, subject.slice(0, 300),
          rendered.html, rendered.text, unsubscribeUrl, def.sensitive, base.dedupeKey,
        ],
      ),
    );
    if (!rows.length) return null;
    this.kickHandler?.();
    return { id, status: 'queued' };
  }

  /** Mẫu hiệu lực: bản ghi đè theo ngôn ngữ → bản ghi đè `vi` → mặc định trong mã. */
  async effective(key: string, locale: string): Promise<EffectiveTemplate> {
    const def = findTemplate(key);
    if (!def) throw new Error(`Loại email không tồn tại: ${key}`);
    const row = (await this.override(key, locale)) ?? (locale !== DEFAULT_LOCALE ? await this.override(key, DEFAULT_LOCALE) : null);
    if (row) {
      return {
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        bodyText: row.bodyText,
        enabled: row.enabled,
        customized: true,
        version: row.version,
        locale: row.locale,
      };
    }
    return { ...def.defaults, bodyText: def.defaults.bodyText, enabled: true, customized: false, version: 0, locale: DEFAULT_LOCALE };
  }

  invalidate(key: string): void {
    for (const locale of EMAIL_LOCALES) this.cache.delete(`${key}:${locale}`);
  }

  async override(key: string, locale: string): Promise<EmailTemplateEntity | null> {
    const cacheKey = `${key}:${locale}`;
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;
    const row = await this.templates.findOne({ where: { key, locale } });
    this.cache.set(cacheKey, { at: Date.now(), row });
    return row;
  }

  /** Giá trị biến thật lúc gửi: biến người gọi + biến toàn cục; thiếu biến → chuỗi rỗng. */
  values(def: TemplateDefinition, input: SendEmailInput): Record<string, string> {
    const out: Record<string, string> = {
      app_name: this.config.appName,
      app_url: this.config.appUrl,
      support_email: this.config.supportEmail,
      display_name: input.to.displayName ?? '',
    };
    for (const variable of allVariables(def)) {
      const provided = input.vars?.[variable.name];
      if (provided !== undefined) out[variable.name] = String(provided);
    }
    return out;
  }

  exampleValues(def: TemplateDefinition): Record<string, string> {
    return Object.fromEntries(allVariables(def).map((v) => [v.name, v.example]));
  }

  // ---- Tùy chọn người dùng & hủy đăng ký ----

  async preferences(userId: string): Promise<Array<{ category: OptionalCategory; enabled: boolean }>> {
    const rows = await this.prefs.find({ where: { userId } });
    const map = new Map(rows.map((r) => [r.category, r.enabled]));
    return OPTIONAL_CATEGORIES.map((category) => ({
      category,
      enabled: map.get(category) ?? category === 'notification',
    }));
  }

  async setPreference(userId: string, category: OptionalCategory, enabled: boolean): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO email_preferences (user_id, category, enabled, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, category) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
      [userId, category, enabled],
    );
  }

  unsubscribeUrl(userId: string | null, category: OptionalCategory): string | null {
    const secret = this.config.linkSecret;
    if (!secret || !userId) return null;
    const token = signUnsubscribe(secret, userId, category);
    const query = new URLSearchParams({ u: userId, c: category, t: token });
    return `${this.config.appUrl}/api/v1/email/unsubscribe?${query.toString()}`;
  }

  /** Liên kết trong thân thư: trang xác nhận của website (tránh bộ quét liên kết tự hủy); header dùng URL API một chạm. */
  unsubscribePageUrl(apiUrl: string): string {
    const query = new URL(apiUrl).search;
    return `${this.config.appUrl}/auth/unsubscribe${query}`;
  }

  /** Trả về false nếu token sai; idempotent nếu đúng. */
  async unsubscribe(userId: string, category: string, token: string): Promise<boolean> {
    const secret = this.config.linkSecret;
    if (!secret || !(OPTIONAL_CATEGORIES as readonly string[]).includes(category)) return false;
    if (!verifyUnsubscribe(secret, userId, category, token)) return false;
    if (!(await this.users.exists({ where: { id: userId } }))) return false;
    await this.setPreference(userId, category as OptionalCategory, false);
    return true;
  }

  // ---- nội bộ ----

  private pickLocale(locale?: string | null): string {
    return locale && (EMAIL_LOCALES as readonly string[]).includes(locale) ? locale : DEFAULT_LOCALE;
  }

  private async isSuppressed(email: string): Promise<boolean> {
    const rows = rowsOf<unknown>(
      await this.dataSource.query('SELECT 1 FROM email_suppressions WHERE email = $1', [email]),
    );
    return rows.length > 0;
  }

  private async allowedByPreference(category: EmailCategory, userId: string | null): Promise<boolean> {
    if (!(OPTIONAL_CATEGORIES as readonly string[]).includes(category)) return true;
    if (!userId) return false;
    const found = await this.prefs.findOne({ where: { userId, category } });
    return found ? found.enabled : category === 'notification';
  }

  /** Fail-open: Redis lỗi thì không chặn (đặc biệt email bảo mật). */
  private async withinRate(email: string, def: TemplateDefinition): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const hit = async (key: string, window: number): Promise<number> => {
        const count = await client.incr(key);
        if (count === 1) await client.expire(key, window);
        return count;
      };
      const hash = Buffer.from(email).toString('base64url');
      const all = await hit(`ratelimit:email:rcpt_${hash}`, 3600);
      if (all > EMAIL_LIMITS.perRecipientPerHour && def.category !== 'security') return false;
      if (def.category === 'notification') {
        const per = await hit(`ratelimit:email:rcpt_${hash}:${def.key}`, 3600);
        if (per > EMAIL_LIMITS.perRecipientTemplatePerHour) return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Bỏ qua giới hạn tần suất email (Redis lỗi): ${(error as Error).message}`);
      return true;
    }
  }

  /** Ghi dòng nhật ký cho email không được gửi (không lưu nội dung). */
  private async record(
    base: { id: string; def: TemplateDefinition; email: string; locale: string; userId: string | null; dedupeKey: string | null },
    status: EmailStatus,
    reason: string,
  ): Promise<{ id: string; status: EmailStatus } | null> {
    const rows = rowsOf<{ id: string }>(
      await this.dataSource.query(
        `INSERT INTO email_messages
           (id, template_key, category, locale, user_id, to_email, subject, sensitive, status,
            attempts, next_attempt_at, last_error, dedupe_key, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,now(),$10,$11,now(),now())
         ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          base.id, base.def.key, base.def.category, base.locale, base.userId, base.email,
          base.def.name, base.def.sensitive, status, reason, base.dedupeKey,
        ],
      ),
    );
    return rows.length ? { id: base.id, status } : null;
  }
}
