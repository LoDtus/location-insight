import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, QueryFailedError, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { notFound, tooMany, unavailable } from '../messaging/messaging-errors.js';
import { catalogOf, type NotificationType } from './notification.catalog.js';
import { NotificationPreferenceEntity, type PreferenceGroups } from './entities/notification-preference.entity.js';
import { NotificationEntity } from './entities/notification.entity.js';
import { PushOutboxEntity } from './entities/push-outbox.entity.js';
import { NotificationEventsService } from './notification-events.service.js';
import { plain, safeLink, topicOf } from './notification.rules.js';

const GROUPS = ['social', 'messages', 'billing', 'moderation', 'system'] as const;
type Group = (typeof GROUPS)[number];

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  link: string;
  params?: Record<string, string>;
  dedupeKey?: string;
  collapseKey?: string;
  actorId?: string;
  push?: boolean;
}

export interface NotificationView {
  id: string;
  type: string;
  category: string;
  icon: string;
  tone: string;
  title: string;
  subtitle: string | null;
  createdAt: string;
  readAt: string | null;
  link: string;
  count: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly events: NotificationEventsService,
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(NotificationPreferenceEntity)
    private readonly preferences: Repository<NotificationPreferenceEntity>,
    @InjectRepository(PushOutboxEntity)
    private readonly outbox: Repository<PushOutboxEntity>,
  ) {}

  async list(
    userId: string,
    limit = 20,
    cursor?: string,
    filter: 'all' | 'unread' = 'all',
  ): Promise<{ items: NotificationView[]; nextCursor: string | null }> {
    await this.limit(userId, 'list', 120, 60);
    const size = Math.min(Math.max(limit, 1), 50);
    const rows = await this.notifications
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.deletedAt IS NULL')
      .andWhere(cursor ? 'n.id < :cursor' : '1=1', { cursor })
      .andWhere(filter === 'unread' ? 'n.readAt IS NULL' : '1=1')
      .orderBy('n.id', 'DESC')
      .take(size + 1)
      .getMany();
    const page = rows.slice(0, size);
    return {
      items: page.map((row) => this.view(row)),
      nextCursor: rows.length > size ? page[page.length - 1].id : null,
    };
  }

  async unreadCount(userId: string): Promise<{ count: number; capped: boolean }> {
    const key = `notif:unread:${userId}`;
    try {
      const cached = await this.redis.getClient().get(key);
      if (cached !== null) return this.cap(Number(cached));
    } catch {
      /* Đọc lại từ cơ sở dữ liệu. */
    }
    const rows = await this.notifications
      .createQueryBuilder('n')
      .select('n.id')
      .where('n.userId = :userId', { userId })
      .andWhere('n.deletedAt IS NULL')
      .andWhere('n.readAt IS NULL')
      .orderBy('n.id', 'DESC')
      .take(100)
      .getMany();
    try {
      await this.redis.getClient().set(key, String(rows.length), 'EX', 300);
    } catch {
      /* Bộ đệm không chặn việc đọc. */
    }
    return this.cap(rows.length);
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.limit(userId, 'write', 120, 60);
    const row = await this.own(userId, id);
    if (!row.readAt) {
      row.readAt = new Date();
      await this.notifications.save(row);
      await this.dropUnread(userId);
      const unread = await this.unreadCount(userId);
      await this.events.changed(userId, { op: 'read', ids: [id], unread: unread.count });
    }
  }

  async markUnread(userId: string, id: string): Promise<void> {
    await this.limit(userId, 'write', 120, 60);
    const row = await this.own(userId, id);
    if (row.readAt) {
      row.readAt = null;
      await this.notifications.save(row);
      await this.dropUnread(userId);
      const unread = await this.unreadCount(userId);
      await this.events.changed(userId, { op: 'unread', ids: [id], unread: unread.count });
    }
  }

  async markReadBatch(userId: string, ids: string[]): Promise<void> {
    await this.limit(userId, 'write', 120, 60);
    await this.notifications
      .createQueryBuilder()
      .update()
      .set({ readAt: () => 'now()' })
      .where('user_id = :userId', { userId })
      .andWhere('deleted_at IS NULL')
      .andWhere('read_at IS NULL')
      .andWhere('id IN (:...ids)', { ids })
      .execute();
    await this.dropUnread(userId);
    const unread = await this.unreadCount(userId);
    await this.events.changed(userId, { op: 'read', ids, unread: unread.count });
  }

  async markReadAll(userId: string, upToId?: string): Promise<{ updated: number }> {
    await this.limit(userId, 'write', 120, 60);
    const latest =
      upToId ??
      (
        await this.notifications.findOne({
          where: { userId, deletedAt: IsNull() },
          order: { id: 'DESC' },
        })
      )?.id;
    if (!latest) return { updated: 0 };
    const result = await this.notifications
      .createQueryBuilder()
      .update()
      .set({ readAt: () => 'now()' })
      .where('user_id = :userId', { userId })
      .andWhere('deleted_at IS NULL')
      .andWhere('read_at IS NULL')
      .andWhere('id <= :latest', { latest })
      .execute();
    await this.dropUnread(userId);
    await this.events.changed(userId, { op: 'read_all', upToId: latest, unread: 0 });
    return { updated: result.affected ?? 0 };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.limit(userId, 'write', 120, 60);
    const row = await this.notifications.findOne({ where: { id, userId } });
    if (!row) notFound('Không tìm thấy thông báo.');
    if (!row.deletedAt) {
      row.deletedAt = new Date();
      await this.notifications.save(row);
      await this.dropUnread(userId);
      const unread = await this.unreadCount(userId);
      await this.events.changed(userId, { op: 'deleted', ids: [id], unread: unread.count });
    }
  }

  async preferencesOf(userId: string) {
    const row = await this.preferences.findOne({ where: { userId } });
    return this.presentPrefs(row);
  }

  async updatePreferences(
    userId: string,
    patch: { hideContentOnLockScreen?: boolean; groups?: PreferenceGroups },
  ) {
    if (patch.groups && 'security' in patch.groups) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Không tắt được thông báo bảo mật.',
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
    const current = (await this.preferences.findOne({ where: { userId } })) ?? this.preferences.create({ userId, groups: {} });
    if (patch.hideContentOnLockScreen !== undefined) {
      current.hideContentOnLockScreen = patch.hideContentOnLockScreen;
    }
    current.groups = { ...current.groups, ...patch.groups };
    await this.preferences.save(current);
    return this.presentPrefs(current);
  }

  async notify(input: NotifyInput): Promise<void> {
    const entry = catalogOf(input.type);
    if (!entry) throw new Error(`Loại thông báo không có trong danh mục: ${input.type}`);
    const link = safeLink(input.link);
    if (!link) throw new Error('Đường dẫn thông báo không hợp lệ.');
    if (entry.category !== 'security') {
      const used = await this.hit(`ratelimit:notif:create:user_${input.userId}:${input.type}`, 3600);
      if (used > 30) return;
    }
    const params = Object.fromEntries(
      Object.entries(input.params ?? {}).map(([key, value]) => [key, plain(value, 80)]),
    );
    const title = plain(entry.title(params), 120);
    const subtitle = plain(entry.subtitle(params), 200) || null;
    const stored = await this.preferences.findOne({ where: { userId: input.userId } });
    const inApp = entry.inApp && this.allows(entry.category, stored, 'inApp');
    const push = entry.push && input.push !== false && this.allows(entry.category, stored, 'push');
    if (!inApp && !push) return;

    if (input.collapseKey && inApp) {
      const open = await this.notifications
        .createQueryBuilder('n')
        .where('n.userId = :userId', { userId: input.userId })
        .andWhere('n.collapseKey = :collapseKey', { collapseKey: input.collapseKey })
        .andWhere('n.readAt IS NULL')
        .andWhere('n.deletedAt IS NULL')
        .andWhere("n.createdAt > now() - interval '60 minutes'")
        .getOne();
      if (open) {
        open.count += 1;
        open.subtitle = subtitle;
        open.link = link;
        await this.notifications.save(open);
        await this.dropUnread(input.userId);
        const unread = await this.unreadCount(input.userId);
        await this.events.created(input.userId, this.view(open), true, unread.count);
        if (push) await this.enqueue(open, entry.urgency, entry.ttl);
        return;
      }
    }

    if (input.dedupeKey) {
      const existing = await this.notifications.findOne({
        where: { userId: input.userId, dedupeKey: input.dedupeKey },
      });
      if (existing) return;
    }

    const row = this.notifications.create({
      id: uuidv7(),
      userId: input.userId,
      type: input.type,
      category: entry.category,
      icon: entry.icon,
      tone: entry.tone,
      title,
      subtitle,
      link,
      params,
      actorId: input.actorId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      collapseKey: input.collapseKey ?? null,
      count: 1,
      readAt: null,
      deletedAt: inApp ? null : new Date(),
    });
    try {
      await this.notifications.save(row);
    } catch (error) {
      if (error instanceof QueryFailedError && String(error.message).includes('uk_notifications_user_dedupe')) return;
      throw error;
    }
    if (push) await this.enqueue(row, entry.urgency, entry.ttl);
    if (!inApp) return;
    await this.dropUnread(input.userId);
    const unread = await this.unreadCount(input.userId);
    await this.events.created(input.userId, this.view(row), false, unread.count);
  }

  private async enqueue(row: NotificationEntity, urgency: PushOutboxEntity['urgency'], ttl: number): Promise<void> {
    const when = new Date(Date.now() + (urgency === 'high' ? 0 : 8000));
    await this.outbox.save(
      this.outbox.create({
        id: uuidv7(),
        notificationId: row.id,
        userId: row.userId,
        status: 'queued',
        urgency,
        ttlSeconds: ttl,
        topic: topicOf(row.type),
        attempts: 0,
        notBefore: when,
        nextAttemptAt: when,
      }),
    );
  }

  private allows(
    category: string,
    stored: NotificationPreferenceEntity | null,
    channel: 'inApp' | 'push',
  ): boolean {
    if (category === 'security' || category === 'admin') return true;
    if (!GROUPS.includes(category as Group)) return true;
    const pref = stored?.groups[category as Group];
    return pref ? pref[channel] : true;
  }

  private presentPrefs(row: NotificationPreferenceEntity | null) {
    const groups = Object.fromEntries(
      GROUPS.map((group) => [group, row?.groups[group] ?? { inApp: true, push: true }]),
    );
    return {
      hideContentOnLockScreen: row?.hideContentOnLockScreen ?? false,
      groups: { ...groups, security: { inApp: true, push: true } },
    };
  }

  private async own(userId: string, id: string): Promise<NotificationEntity> {
    const row = await this.notifications.findOne({ where: { id, userId, deletedAt: IsNull() } });
    if (!row) notFound('Không tìm thấy thông báo.');
    return row;
  }

  private view(row: NotificationEntity): NotificationView {
    return {
      id: row.id,
      type: row.type,
      category: row.category,
      icon: row.icon,
      tone: row.tone,
      title: row.title,
      subtitle: row.subtitle,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt ? row.readAt.toISOString() : null,
      link: row.link,
      count: row.count,
    };
  }

  private cap(raw: number): { count: number; capped: boolean } {
    const safe = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    return { count: Math.min(safe, 99), capped: safe >= 100 };
  }

  private async dropUnread(userId: string): Promise<void> {
    await this.redis.getClient().del(`notif:unread:${userId}`).catch(() => undefined);
  }

  private async limit(userId: string, kind: 'list' | 'write', max: number, ttl: number): Promise<void> {
    const used = await this.hit(`ratelimit:notif:${kind}:user_${userId}`, ttl);
    if (used > max) tooMany(ttl);
  }

  private async hit(key: string, ttl: number): Promise<number> {
    try {
      const result = await this.redis.getClient().eval(
        "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
        1,
        key,
        String(ttl),
      );
      return Number(result);
    } catch (error) {
      this.logger.warn(`Redis lỗi khi giới hạn ${key}: ${error instanceof Error ? error.message : 'không rõ'}`);
      unavailable();
    }
  }
}
