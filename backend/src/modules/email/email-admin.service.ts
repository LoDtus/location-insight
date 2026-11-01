import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { invalid, notFound, tooMany, unavailable } from '../messaging/messaging-errors.js';
import { rowsOf } from '../messaging/messaging-db.js';
import { readCursor, writeCursor } from '../messaging/messaging-rules.js';
import { Principal } from '../rbac/authorization.types.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import {
  allVariables,
  EMAIL_CATALOG,
  findTemplate,
  TemplateDefinition,
} from './email.catalog.js';
import { DEFAULT_LOCALE, EMAIL_LIMITS, EMAIL_LOCALES } from './email.constants.js';
import { EmailService } from './email.service.js';
import { renderEmail, sanitizeTemplateHtml, unknownVariables } from './email-render.js';
import { EmailSuppressionEntity } from './entities/email-suppression.entity.js';
import { EmailTemplateEntity } from './entities/email-template.entity.js';
import { MessagesQueryDto, PreviewTemplateDto, SaveTemplateDto } from './dto/email.dto.js';

function conflictCode(message: string, code: string): never {
  throw new BusinessException(ErrorCode.CONFLICT, message, { code }, HttpStatus.CONFLICT);
}

@Injectable()
export class EmailAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly email: EmailService,
    @InjectRepository(EmailTemplateEntity) private readonly templates: Repository<EmailTemplateEntity>,
    @InjectRepository(EmailSuppressionEntity) private readonly suppressions: Repository<EmailSuppressionEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(AdminAuditLogEntity) private readonly audits: Repository<AdminAuditLogEntity>,
  ) {}

  // ---- Mẫu ----

  async listTemplates() {
    const rows = await this.templates.find();
    return EMAIL_CATALOG.map((def) => ({
      key: def.key,
      category: def.category,
      name: def.name,
      description: def.description,
      locales: EMAIL_LOCALES.map((locale) => {
        const row = rows.find((r) => r.key === def.key && r.locale === locale);
        return {
          locale,
          customized: Boolean(row),
          enabled: row ? row.enabled : true,
          updatedAt: row ? row.updatedAt.toISOString() : null,
        };
      }),
    }));
  }

  async getTemplate(key: string, locale: string = DEFAULT_LOCALE) {
    const def = this.def(key);
    const row = await this.templates.findOne({ where: { key, locale } });
    const base = row
      ? { subject: row.subject, bodyHtml: row.bodyHtml, bodyText: row.bodyText, enabled: row.enabled, version: row.version }
      : { ...def.defaults, enabled: true, version: 0 };
    return {
      key,
      locale,
      category: def.category,
      name: def.name,
      customized: Boolean(row),
      ...base,
      defaults: def.defaults,
      variables: allVariables(def).map(({ name, description, example }) => ({ name, description, example })),
    };
  }

  async saveTemplate(actor: Principal, key: string, locale: string, dto: SaveTemplateDto, ip: string | null) {
    const def = this.def(key);
    this.assertLocale(locale);
    if (dto.enabled === false && def.category === 'security') {
      invalid('Email bảo mật không thể tắt.', { code: 'security_cannot_disable' });
    }
    const bodyText = dto.bodyText?.trim() ? dto.bodyText : null;
    const unknown = unknownVariables(def, [dto.subject, dto.bodyHtml, bodyText ?? '']);
    if (unknown.length) {
      invalid(`Biến không hợp lệ: ${unknown.join(', ')}`, { code: 'unknown_variable', variables: unknown });
    }
    const bodyHtml = sanitizeTemplateHtml(dto.bodyHtml);
    if (!bodyHtml.replace(/<[^>]*>/g, '').trim()) invalid('Nội dung email không được rỗng.');
    const subject = dto.subject.replace(/[\r\n]+/g, ' ').trim();
    if (!subject) invalid('Tiêu đề không được rỗng.');

    const before = await this.templates.findOne({ where: { key, locale } });
    const enabled = dto.enabled ?? true;
    await this.dataSource.query(
      `INSERT INTO email_templates (id, key, locale, subject, body_html, body_text, enabled, version, updated_by, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 1, $7, now(), now())
       ON CONFLICT (key, locale) DO UPDATE SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
         body_text = EXCLUDED.body_text, enabled = EXCLUDED.enabled,
         version = email_templates.version + 1, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, locale, subject, bodyHtml, bodyText, enabled, actor.userId],
    );
    this.email.invalidate(key);
    await this.audit(actor, 'email_template_update', `${key}:${locale}`,
      before ? { subject: before.subject, enabled: before.enabled, version: before.version } : null,
      { subject, enabled }, ip);
    return this.getTemplate(key, locale);
  }

  async resetTemplate(actor: Principal, key: string, locale: string, ip: string | null) {
    this.def(key);
    this.assertLocale(locale);
    const before = await this.templates.findOne({ where: { key, locale } });
    if (before) {
      await this.templates.delete({ key, locale });
      this.email.invalidate(key);
      await this.audit(actor, 'email_template_reset', `${key}:${locale}`, { version: before.version }, {}, ip);
    }
    return this.getTemplate(key, locale);
  }

  async preview(key: string, dto: PreviewTemplateDto) {
    const def = this.def(key);
    const locale = dto.locale ?? DEFAULT_LOCALE;
    const current = await this.getTemplate(key, locale);
    const subject = dto.subject ?? current.subject;
    const bodyHtml = dto.bodyHtml ?? current.bodyHtml;
    const bodyText = dto.bodyText === undefined ? current.bodyText : dto.bodyText;
    const unknown = unknownVariables(def, [subject, bodyHtml, bodyText ?? '']);
    if (unknown.length) invalid(`Biến không hợp lệ: ${unknown.join(', ')}`, { code: 'unknown_variable', variables: unknown });
    const values = this.email.exampleValues(def);
    return renderEmail({
      def,
      subject,
      bodyHtml: sanitizeTemplateHtml(bodyHtml),
      bodyText: bodyText?.trim() ? bodyText : null,
      values,
      unsubscribeUrl: def.category === 'notification' || def.category === 'marketing' ? 'https://example.com/unsubscribe' : null,
    });
  }

  async sendTest(actor: Principal, key: string, locale: string) {
    const def = this.def(key);
    this.assertLocale(locale);
    const user = await this.users.findOne({ where: { id: actor.userId as string } });
    if (!user) notFound('Không tìm thấy tài khoản.');
    try {
      const client = this.redis.getClient();
      const rk = `ratelimit:email:test:user_${user.id}`;
      const count = await client.incr(rk);
      if (count === 1) await client.expire(rk, 3600);
      if (count > EMAIL_LIMITS.testPerHour) tooMany(Math.max(1, await client.ttl(rk)));
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      return unavailable();
    }
    const result = await this.email.enqueue({
      template: def.key,
      to: { userId: user.id, email: user.email, displayName: user.displayName, locale },
      vars: this.email.exampleValues(def),
      test: true,
    });
    if (!result) conflictCode('Không xếp hàng được email thử.', 'not_queued');
    return result;
  }

  // ---- Nhật ký ----

  async listMessages(query: MessagesQueryDto) {
    const size = query.limit ?? 30;
    const params: unknown[] = [];
    const where: string[] = [];
    if (query.status) {
      params.push(query.status);
      where.push(`status = $${params.length}`);
    }
    if (query.template) {
      params.push(query.template);
      where.push(`template_key = $${params.length}`);
    }
    if (query.q?.trim()) {
      params.push(`${query.q.trim().toLowerCase().replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`to_email LIKE $${params.length}`);
    }
    const point = readCursor(query.cursor, 2);
    if (point) {
      params.push(point[0], point[1]);
      where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
    params.push(size + 1);
    const rows = rowsOf<Record<string, unknown>>(
      await this.dataSource.query(
        `SELECT id, template_key, category, locale, to_email, subject, status, attempts, last_error,
                (body_html IS NOT NULL) AS has_content, sent_at, created_at, created_at::text AS cur
           FROM email_messages ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
        params,
      ),
    );
    const hasMore = rows.length > size;
    const slice = hasMore ? rows.slice(0, size) : rows;
    const last = slice.at(-1);
    return {
      items: slice.map(({ cur: _cur, ...r }) => ({
        id: r.id,
        templateKey: r.template_key,
        category: r.category,
        locale: r.locale,
        to: r.to_email,
        subject: r.subject,
        status: r.status,
        attempts: r.attempts,
        error: r.last_error,
        hasContent: r.has_content,
        sentAt: r.sent_at,
        createdAt: r.created_at,
      })),
      nextCursor: hasMore && last ? writeCursor([String(last.cur), String(last.id)]) : null,
    };
  }

  async retry(actor: Principal, id: string, ip: string | null) {
    const rows = rowsOf<{ id: string }>(
      await this.dataSource.query(
        `UPDATE email_messages SET status = 'queued', attempts = 0, next_attempt_at = now(),
                last_error = NULL, updated_at = now()
          WHERE id = $1 AND status = 'dead' AND body_html IS NOT NULL RETURNING id`,
        [id],
      ),
    );
    if (!rows.length) {
      const row = rowsOf<{ status: string }>(
        await this.dataSource.query('SELECT status FROM email_messages WHERE id = $1', [id]),
      )[0];
      if (!row) notFound('Không tìm thấy email.');
      if (row.status !== 'dead') conflictCode('Chỉ thử lại được email đã thất bại.', 'not_dead');
      conflictCode('Nội dung đã bị xóa vì chứa thông tin nhạy cảm, không thể thử lại.', 'content_purged');
    }
    await this.audit(actor, 'email_retry', id, null, {}, ip);
    return { id, status: 'queued' };
  }

  async stats() {
    const byStatus = rowsOf<{ status: string; n: string }>(
      await this.dataSource.query(
        `SELECT status, count(*)::text AS n FROM email_messages
          WHERE created_at > now() - interval '24 hours' GROUP BY status`,
      ),
    );
    const queue = rowsOf<{ depth: string; oldest: string | null }>(
      await this.dataSource.query(
        `SELECT count(*)::text AS depth,
                EXTRACT(EPOCH FROM (now() - min(created_at)))::int::text AS oldest
           FROM email_messages WHERE status IN ('queued','sending')`,
      ),
    )[0];
    return {
      last24h: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
      queueDepth: Number(queue?.depth ?? 0),
      oldestPendingSeconds: queue?.oldest ? Number(queue.oldest) : 0,
    };
  }

  // ---- Danh sách chặn ----

  async listSuppressions() {
    const rows = await this.suppressions.find({ order: { createdAt: 'DESC' }, take: 200 });
    return rows.map((r) => ({ email: r.email, reason: r.reason, note: r.note, createdAt: r.createdAt.toISOString() }));
  }

  async addSuppression(actor: Principal, emailRaw: string, note: string | undefined, ip: string | null) {
    const email = emailRaw.trim().toLowerCase();
    await this.dataSource.query(
      `INSERT INTO email_suppressions (email, reason, note, created_by, created_at)
       VALUES ($1, 'manual', $2, $3, now()) ON CONFLICT (email) DO NOTHING`,
      [email, note ?? null, actor.userId],
    );
    await this.audit(actor, 'email_suppress', email, null, { note: note ?? null }, ip);
    return { email };
  }

  async removeSuppression(actor: Principal, emailRaw: string, ip: string | null) {
    const email = emailRaw.trim().toLowerCase();
    const result = await this.suppressions.delete({ email });
    if (result.affected) await this.audit(actor, 'email_unsuppress', email, null, {}, ip);
    return { email };
  }

  // ---- nội bộ ----

  private def(key: string): TemplateDefinition {
    const def = findTemplate(key);
    if (!def) notFound('Không có loại email này.');
    return def;
  }

  private assertLocale(locale: string): void {
    if (!(EMAIL_LOCALES as readonly string[]).includes(locale)) invalid('Ngôn ngữ không được hỗ trợ.');
  }

  private async audit(
    actor: Principal,
    action: string,
    targetId: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown>,
    ip: string | null,
  ): Promise<void> {
    await this.audits.save(
      this.audits.create({
        actorId: actor.userId,
        actorType: 'admin',
        action,
        targetType: 'email',
        targetId: targetId.slice(0, 64),
        before,
        after,
        reason: null,
        ipAddress: ip,
        sessionId: actor.sessionId,
      }),
    );
  }
}
