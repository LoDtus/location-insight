import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notification/notification.service.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { presentAvatarUrl } from '../auth/avatar-url.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { sniffMedia } from '../discussions/discussion-text.js';
import { invalid, notFound, tooMany, unavailable } from '../messaging/messaging-errors.js';
import { readCursor, writeCursor } from '../messaging/messaging-rules.js';
import { cleanMessage } from '../messaging/messaging-text.js';
import { Principal } from '../rbac/authorization.types.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import {
  CreateFeedbackDto,
  FeedbackListQueryDto,
  FeedbackMediaDto,
} from './dto/feedback.dto.js';
import { FeedbackMediaEntity } from './entities/feedback-media.entity.js';
import { FeedbackReplyEntity } from './entities/feedback-reply.entity.js';
import { FeedbackEntity, FeedbackStatus } from './entities/feedback.entity.js';

const PAGE = 20;
const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;
const IMAGES_MAX = 4;
const READ_URL_TTL = 3600;
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

const LIMITS = {
  feedback: { window: 60 * 60, max: 5 },
  reply: { window: 60 * 60, max: 30 },
  media: { window: 60 * 60, max: 30 },
} as const;

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
};

export interface FeedbackView {
  id: string;
  category: FeedbackEntity['category'];
  description: string;
  status: FeedbackStatus;
  replyCount: number;
  lastReplyBy: 'user' | 'admin' | null;
  /** Người gửi: có trả lời của admin chưa đọc. Admin: đang chờ admin trả lời. */
  unread: boolean;
  createdAt: string;
  lastActivityAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  media: Array<{ id: string; kind: 'image' | 'video'; contentType: string; url: string }>;
}

export interface FeedbackDetail extends FeedbackView {
  replies: Array<{
    id: string;
    authorRole: 'user' | 'admin';
    authorName: string;
    body: string;
    createdAt: string;
  }>;
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    @InjectRepository(FeedbackEntity) private readonly feedbacks: Repository<FeedbackEntity>,
    @InjectRepository(FeedbackMediaEntity) private readonly media: Repository<FeedbackMediaEntity>,
    @InjectRepository(FeedbackReplyEntity) private readonly replies: Repository<FeedbackReplyEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(AdminAuditLogEntity) private readonly audits: Repository<AdminAuditLogEntity>,
  ) {}

  // --- Tệp đính kèm --------------------------------------------------------

  async prepareMedia(userId: string, input: FeedbackMediaDto) {
    const video = input.contentType === 'video/mp4';
    if (input.byteSize > (video ? VIDEO_MAX : IMAGE_MAX)) {
      invalid(video ? 'Video lớn hơn 50 MB.' : 'Ảnh lớn hơn 8 MB.');
    }
    await this.consume(userId, 'media');
    const id = uuidv7();
    const objectKey = `feedback/${userId}/${id}.${EXTENSION[input.contentType]}`;
    await this.media.save(
      this.media.create({
        id,
        feedbackId: null,
        uploaderId: userId,
        objectKey,
        contentType: input.contentType,
        byteSize: input.byteSize,
        kind: video ? 'video' : 'image',
        status: 'pending',
      }),
    );
    return {
      id,
      uploadUrl: await this.storage.getPresignedPutUrl(objectKey, input.contentType, 600),
    };
  }

  async completeMedia(userId: string, id: string) {
    const row = await this.media.findOne({ where: { id, uploaderId: userId } });
    if (!row || row.status === 'rejected') notFound('Không tìm thấy tệp.');
    const reject = async (): Promise<never> => {
      await this.storage.deleteObject(row.objectKey).catch(() => undefined);
      row.status = 'rejected';
      await this.media.save(row);
      return invalid('Nội dung tệp không khớp loại đã khai.');
    };
    const size = await this.storage.objectSize(row.objectKey);
    const max = row.kind === 'video' ? VIDEO_MAX : IMAGE_MAX;
    if (!size || size > max) return reject();
    const head = await this.storage.getObjectRange(row.objectKey, 32).catch(() => Buffer.alloc(0));
    if (!sniffMedia(head, row.contentType)) return reject();
    row.status = 'ready';
    row.byteSize = size;
    await this.media.save(row);
    return { id: row.id, status: row.status };
  }

  // --- Người dùng ----------------------------------------------------------

  async create(userId: string, input: CreateFeedbackDto): Promise<FeedbackDetail> {
    await this.consume(userId, 'feedback');
    const description = cleanMessage(input.description);
    if (description.length < 10) invalid('Hãy mô tả ít nhất 10 ký tự.');
    const id = await this.dataSource.transaction(async (manager) => {
      const files = await this.takeMedia(manager, userId, input.mediaIds);
      const saved = await manager.save(
        manager.create(FeedbackEntity, {
          authorId: userId,
          category: input.category,
          description,
          status: 'open',
          replyCount: 0,
          lastReplyBy: null,
          lastActivityAt: new Date(),
          userReadAt: new Date(),
        }),
      );
      for (const [index, file] of files.entries()) {
        file.feedbackId = saved.id;
        file.sortOrder = index;
        await manager.save(file);
      }
      return saved.id;
    });
    return this.detail(id, { forAdmin: false });
  }

  async listMine(userId: string, query: FeedbackListQueryDto) {
    return this.page(query, { authorId: userId, forAdmin: false });
  }

  async getMine(userId: string, id: string): Promise<FeedbackDetail> {
    const row = await this.feedbacks.findOne({ where: { id, authorId: userId } });
    if (!row) notFound('Không tìm thấy góp ý.');
    await this.feedbacks.update({ id }, { userReadAt: new Date() });
    return this.detail(id, { forAdmin: false });
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.feedbacks
      .createQueryBuilder('f')
      .where('f.authorId = :userId', { userId })
      .andWhere("f.lastReplyBy = 'admin'")
      .andWhere('f.lastActivityAt > f.userReadAt')
      .getCount();
    return { count };
  }

  async replyAsUser(userId: string, id: string, bodyText: string): Promise<FeedbackDetail> {
    const row = await this.feedbacks.findOne({ where: { id, authorId: userId } });
    if (!row) notFound('Không tìm thấy góp ý.');
    if (row.status === 'closed') invalid('Góp ý này đã đóng.');
    await this.consume(userId, 'reply');
    await this.addReply(row, userId, 'user', bodyText);
    return this.detail(id, { forAdmin: false });
  }

  // --- Admin ---------------------------------------------------------------

  async listAll(query: FeedbackListQueryDto) {
    return this.page(query, { forAdmin: true });
  }

  async getAny(id: string): Promise<FeedbackDetail> {
    return this.detail(id, { forAdmin: true });
  }

  async openCount(): Promise<{ count: number }> {
    const count = await this.feedbacks
      .createQueryBuilder('f')
      .where("f.status IN ('open', 'in_progress')")
      .andWhere("(f.lastReplyBy IS NULL OR f.lastReplyBy = 'user')")
      .getCount();
    return { count };
  }

  async replyAsAdmin(actor: Principal, id: string, bodyText: string, ip: string | null): Promise<FeedbackDetail> {
    const row = await this.feedbacks.findOne({ where: { id } });
    if (!row) notFound('Không tìm thấy góp ý.');
    const reply = await this.addReply(row, actor.userId as string, 'admin', bodyText);
    if (row.status === 'open') await this.feedbacks.update({ id }, { status: 'in_progress' });
    await this.audit(actor, 'feedback_reply', id, null, { replyId: reply.id }, ip);
    await this.notifyAuthor(row, reply.body);
    void this.notifications.notify({
      userId: row.authorId,
      type: 'feedback.replied',
      link: `/app/feedback/${row.id}`,
      params: { preview: reply.body.slice(0, 80) },
      dedupeKey: `feedback.replied:${reply.id}`,
    });
    return this.detail(id, { forAdmin: true });
  }

  async setStatus(actor: Principal, id: string, status: FeedbackStatus, ip: string | null): Promise<FeedbackDetail> {
    const row = await this.feedbacks.findOne({ where: { id } });
    if (!row) notFound('Không tìm thấy góp ý.');
    const before = row.status;
    if (before !== status) {
      await this.feedbacks.update({ id }, { status, lastActivityAt: new Date() });
      await this.audit(actor, 'feedback_status', id, { status: before }, { status }, ip);
    }
    return this.detail(id, { forAdmin: true });
  }

  // --- Dọn dẹp -------------------------------------------------------------

  async cleanup(): Promise<void> {
    const stale = await this.media
      .createQueryBuilder('m')
      .where("m.status IN ('pending', 'rejected')")
      .andWhere('m.createdAt < :cutoff', { cutoff: new Date(Date.now() - PENDING_TTL_MS) })
      .take(100)
      .getMany();
    for (const file of stale) {
      await this.storage.deleteObject(file.objectKey).catch(() => undefined);
      await this.media.delete({ id: file.id });
    }
  }

  // --- Nội bộ --------------------------------------------------------------

  private async notifyAuthor(row: FeedbackEntity, replyBody: string): Promise<void> {
    const author = await this.users.findOne({ where: { id: row.authorId } });
    if (!author?.emailVerifiedAt) return;
    const origin = (process.env.AUTH_ALLOWED_ORIGINS ?? '').split(',')[0]?.trim() || 'http://127.0.0.1:22360';
    const excerpt = (text: string) => (text.length > 200 ? `${text.slice(0, 200)}…` : text);
    await this.email.send({
      template: 'feedback_reply',
      to: { userId: author.id, email: author.email, displayName: author.displayName, locale: author.locale },
      vars: {
        feedback_excerpt: excerpt(row.description),
        reply_excerpt: excerpt(replyBody),
        feedback_url: `${origin}/app/feedback/${row.id}`,
      },
    });
  }

  private async addReply(
    row: FeedbackEntity,
    authorId: string,
    role: 'user' | 'admin',
    bodyText: string,
  ): Promise<FeedbackReplyEntity> {
    const body = cleanMessage(bodyText);
    if (!body) invalid('Nội dung không được để trống.');
    return this.dataSource.transaction(async (manager) => {
      const reply = await manager.save(
        manager.create(FeedbackReplyEntity, { feedbackId: row.id, authorId, authorRole: role, body }),
      );
      const patch: Partial<FeedbackEntity> = {
        replyCount: row.replyCount + 1,
        lastReplyBy: role,
        lastActivityAt: new Date(),
      };
      // Người gửi trả lời lại một góp ý đã xử lý thì mở lại.
      if (role === 'user' && row.status === 'resolved') patch.status = 'open';
      if (role === 'user') patch.userReadAt = new Date();
      await manager.update(FeedbackEntity, { id: row.id }, patch);
      return reply;
    });
  }

  private async takeMedia(
    manager: DataSource['manager'],
    userId: string,
    ids: string[] | undefined,
  ): Promise<FeedbackMediaEntity[]> {
    if (!ids?.length) return [];
    if (new Set(ids).size !== ids.length) invalid('Tệp bị lặp.');
    const rows = await manager.find(FeedbackMediaEntity, {
      where: { id: In(ids), uploaderId: userId, status: 'ready' },
    });
    if (rows.length !== ids.length || rows.some((row) => row.feedbackId)) {
      invalid('Có tệp chưa sẵn sàng hoặc không phải của bạn.');
    }
    const videos = rows.filter((row) => row.kind === 'video').length;
    if (videos > 1 || rows.length - videos > IMAGES_MAX) {
      invalid('Tối đa 4 ảnh và 1 video cho mỗi góp ý.');
    }
    const order = new Map(ids.map((id, index) => [id, index]));
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  private async page(
    query: FeedbackListQueryDto,
    scope: { authorId?: string; forAdmin: boolean },
  ): Promise<{ items: FeedbackView[]; nextCursor: string | null }> {
    const qb = this.feedbacks
      .createQueryBuilder('f')
      .orderBy('f.lastActivityAt', 'DESC')
      .addOrderBy('f.id', 'DESC')
      .take(PAGE + 1);
    if (scope.authorId) qb.where('f.authorId = :authorId', { authorId: scope.authorId });
    if (query.status) qb.andWhere('f.status = :status', { status: query.status });
    if (query.category) qb.andWhere('f.category = :category', { category: query.category });
    const point = readCursor(query.cursor, 2);
    if (point) {
      qb.andWhere('(f.lastActivityAt < :at OR (f.lastActivityAt = :at AND f.id < :id))', {
        at: new Date(point[0] as string),
        id: point[1],
      });
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > PAGE;
    const slice = hasMore ? rows.slice(0, PAGE) : rows;
    const last = slice.at(-1);
    return {
      items: await this.present(slice, scope.forAdmin),
      nextCursor: hasMore && last ? writeCursor([last.lastActivityAt.toISOString(), last.id]) : null,
    };
  }

  private async detail(id: string, scope: { forAdmin: boolean }): Promise<FeedbackDetail> {
    const row = await this.feedbacks.findOne({ where: { id } });
    if (!row) notFound('Không tìm thấy góp ý.');
    const [view] = await this.present([row], scope.forAdmin);
    const replies = await this.replies.find({ where: { feedbackId: id }, order: { createdAt: 'ASC' } });
    const people = await this.people(replies.map((item) => item.authorId));
    return {
      ...(view as FeedbackView),
      replies: replies.map((item) => ({
        id: item.id,
        authorRole: item.authorRole,
        authorName: item.authorRole === 'admin' ? 'Đội ngũ Địa Thế' : (people.get(item.authorId)?.displayName ?? 'Người dùng'),
        body: item.body,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  private async present(rows: FeedbackEntity[], forAdmin: boolean): Promise<FeedbackView[]> {
    if (!rows.length) return [];
    const files = await this.media.find({
      where: { feedbackId: In(rows.map((row) => row.id)), status: 'ready' },
      order: { sortOrder: 'ASC' },
    });
    const urls = new Map<string, string>();
    await Promise.all(
      files.map(async (file) => {
        urls.set(file.id, await this.storage.getPresignedUrl(file.objectKey, READ_URL_TTL));
      }),
    );
    const people = await this.people(rows.map((row) => row.authorId));
    return rows.map((row) => {
      const author = people.get(row.authorId);
      return {
        id: row.id,
        category: row.category,
        description: row.description,
        status: row.status,
        replyCount: row.replyCount,
        lastReplyBy: row.lastReplyBy,
        unread: forAdmin
          ? (row.status === 'open' || row.status === 'in_progress') && row.lastReplyBy !== 'admin'
          : row.lastReplyBy === 'admin' && row.lastActivityAt > row.userReadAt,
        createdAt: row.createdAt.toISOString(),
        lastActivityAt: row.lastActivityAt.toISOString(),
        author: {
          id: row.authorId,
          displayName: author?.displayName ?? 'Người dùng',
          avatarUrl: presentAvatarUrl(author?.avatarUrl),
        },
        media: files
          .filter((file) => file.feedbackId === row.id)
          .map((file) => ({
            id: file.id,
            kind: file.kind,
            contentType: file.contentType,
            url: urls.get(file.id) ?? '',
          })),
      };
    });
  }

  private async people(ids: string[]): Promise<Map<string, UserEntity>> {
    const unique = [...new Set(ids)];
    const rows = unique.length ? await this.users.find({ where: { id: In(unique) }, withDeleted: true }) : [];
    return new Map(rows.map((row) => [row.id, row]));
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
        targetType: 'feedback',
        targetId,
        before,
        after,
        reason: null,
        ipAddress: ip,
        sessionId: actor.sessionId,
      }),
    );
  }

  /** Giới hạn khi ghi: Redis lỗi thì từ chối, không mở không giới hạn. */
  private async consume(userId: string, kind: keyof typeof LIMITS): Promise<void> {
    const rule = LIMITS[kind];
    let count: number;
    let ttl: number;
    try {
      const key = `ratelimit:feedback:${kind}:user_${userId}`;
      const client = this.redis.getClient();
      count = await client.incr(key);
      if (count === 1) await client.expire(key, rule.window);
      ttl = await client.ttl(key);
    } catch {
      return unavailable();
    }
    if (count > rule.max) tooMany(Math.max(1, ttl));
  }
}
