import { HttpStatus, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, QueryFailedError, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { Principal } from '../rbac/authorization.types.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { plainText, sniffMedia } from './discussion-text.js';
import {
  CreateMediaDto,
  CreatePostDto,
  CreateReplyDto,
  CreateTopicDto,
} from './dto/discussion.dto.js';
import { DiscussionLikeEntity } from './entities/discussion-like.entity.js';
import {
  DiscussionMediaEntity,
  MediaKind,
} from './entities/discussion-media.entity.js';
import {
  DiscussionPostEntity,
  PostStatus,
} from './entities/discussion-post.entity.js';
import { DiscussionReportEntity } from './entities/discussion-report.entity.js';
import {
  DiscussionTopicEntity,
  TopicStatus,
} from './entities/discussion-topic.entity.js';

const PAGE = 20;
const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;
const CLEANUP_MS = 7 * 24 * 60 * 60 * 1000;

const LIMITS = {
  topic: { window: 24 * 60 * 60, max: 5 },
  post: { window: 60 * 60, max: 20 },
  media: { window: 60 * 60, max: 30 },
} as const;

export interface MediaView {
  id: string;
  kind: MediaKind;
  contentType: string;
  url: string;
}

export interface PostView {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  topicId: string;
  topicSlug: string;
  topicName: string;
  rootId: string | null;
  parentId: string | null;
  parentAuthorName: string | null;
  kind: DiscussionPostEntity['kind'];
  body: string;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  createdAt: Date;
  media: MediaView[];
}

@Injectable()
export class DiscussionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    @InjectRepository(DiscussionTopicEntity)
    private readonly topics: Repository<DiscussionTopicEntity>,
    @InjectRepository(DiscussionPostEntity)
    private readonly posts: Repository<DiscussionPostEntity>,
    @InjectRepository(DiscussionMediaEntity)
    private readonly media: Repository<DiscussionMediaEntity>,
    @InjectRepository(DiscussionLikeEntity)
    private readonly likes: Repository<DiscussionLikeEntity>,
    @InjectRepository(DiscussionReportEntity)
    private readonly reports: Repository<DiscussionReportEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AdminAuditLogEntity)
    private readonly audits: Repository<AdminAuditLogEntity>,
  ) {}

  async listTopics(query?: string, cursor?: string) {
    const page = await this.pageTopics(query, cursor);
    return page;
  }

  async createTopic(userId: string, input: CreateTopicDto) {
    await this.consume(userId, 'topic');
    const name = plainText(input.name);
    const summary = plainText(input.summary ?? '');
    if (name.length < 3) this.invalid('Tên chủ đề cần ít nhất 3 ký tự.');
    try {
      const saved = await this.topics.save(
        this.topics.create({
          authorId: userId,
          name,
          slug: input.slug,
          summary,
          status: 'open',
        }),
      );
      return this.topicView(saved);
    } catch (error) {
      if (isUnique(error)) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Slug này đã được dùng.',
          null,
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async topicFeed(slug: string, viewerId: string, cursor?: string) {
    const topic = await this.topics.findOne({ where: { slug } });
    if (!topic || topic.status === 'hidden') this.missing('Không tìm thấy chủ đề.');
    const page = await this.pagePosts(cursor, topic.id, viewerId);
    return { topic: this.topicView(topic), ...page };
  }

  async listPosts(viewerId: string, cursor?: string) {
    return this.pagePosts(cursor, null, viewerId);
  }

  async createPost(userId: string, input: CreatePostDto): Promise<PostView> {
    await this.consume(userId, 'post');
    const body = this.requireBody(input.body);
    const saved = await this.dataSource.transaction(async (manager) => {
      const topic = await manager.findOne(DiscussionTopicEntity, {
        where: { slug: input.topicSlug },
        lock: { mode: 'pessimistic_write' },
      });
      if (!topic || topic.status !== 'open') {
        this.invalid('Chủ đề không còn nhận bài mới.');
      }
      const files = await this.takeMedia(manager, userId, input.mediaIds);
      const post = await manager.save(
        manager.create(DiscussionPostEntity, {
          authorId: userId,
          topicId: topic.id,
          rootId: null,
          parentId: null,
          kind: input.kind,
          body,
          status: 'visible',
          replyCount: 0,
          likeCount: 0,
        }),
      );
      await this.attach(manager, post.id, files);
      return post;
    });
    const [view] = await this.present([saved], userId);
    return view;
  }

  async getThread(id: string, viewerId: string, cursor?: string) {
    const root = await this.posts.findOne({ where: { id, rootId: IsNull(), status: 'visible' } });
    if (!root) this.missing('Không tìm thấy bài.');
    const qb = this.posts
      .createQueryBuilder('post')
      .where('post.rootId = :rootId', { rootId: root.id })
      .andWhere('post.status = :status', { status: 'visible' })
      .orderBy('post.createdAt', 'ASC')
      .addOrderBy('post.id', 'ASC')
      .take(PAGE + 1);
    const point = readCursor(cursor);
    if (point) {
      qb.andWhere(
        '(post.createdAt > :at OR (post.createdAt = :at AND post.id > :id))',
        { at: point.at, id: point.id },
      );
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > PAGE;
    const slice = hasMore ? rows.slice(0, PAGE) : rows;
    const last = slice.at(-1);
    const [post, replies] = await Promise.all([
      this.present([root], viewerId),
      this.present(slice, viewerId),
    ]);
    return {
      post: post[0],
      replies,
      nextCursor: hasMore && last ? writeCursor(last.createdAt, last.id) : null,
    };
  }

  async reply(userId: string, rootId: string, input: CreateReplyDto): Promise<PostView> {
    await this.consume(userId, 'post');
    const body = this.requireBody(input.body);
    const saved = await this.dataSource.transaction(async (manager) => {
      const root = await manager.findOne(DiscussionPostEntity, {
        where: { id: rootId, rootId: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!root || root.status !== 'visible') this.missing('Không tìm thấy bài.');
      const topic = await manager.findOne(DiscussionTopicEntity, {
        where: { id: root.topicId },
      });
      if (!topic || topic.status !== 'open') {
        this.invalid('Chủ đề không còn nhận trả lời.');
      }
      const parentId = input.parentId ?? root.id;
      if (parentId !== root.id) {
        const parent = await manager.findOne(DiscussionPostEntity, {
          where: { id: parentId, rootId: root.id, status: 'visible' },
        });
        if (!parent) this.invalid('Bài được trả lời không còn trong mạch.');
      }
      const files = await this.takeMedia(manager, userId, input.mediaIds);
      const post = await manager.save(
        manager.create(DiscussionPostEntity, {
          authorId: userId,
          topicId: root.topicId,
          rootId: root.id,
          parentId,
          kind: 'reply',
          body,
          status: 'visible',
          replyCount: 0,
          likeCount: 0,
        }),
      );
      root.replyCount += 1;
      await manager.save(root);
      await this.attach(manager, post.id, files);
      return post;
    });
    const [view] = await this.present([saved], userId);
    return view;
  }

  async removeOwn(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const post = await manager.findOne(DiscussionPostEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post || post.status === 'deleted' || post.authorId !== userId) {
        this.missing('Không tìm thấy bài của bạn.');
      }
      if (post.rootId && post.status === 'visible') {
        await manager.decrement(
          DiscussionPostEntity,
          { id: post.rootId },
          'replyCount',
          1,
        );
      }
      post.status = 'deleted';
      post.deletedAt = new Date();
      await manager.save(post);
    });
  }

  async like(userId: string, id: string): Promise<{ likeCount: number }> {
    return this.setLike(userId, id, true);
  }

  async unlike(userId: string, id: string): Promise<{ likeCount: number }> {
    return this.setLike(userId, id, false);
  }

  async report(userId: string, id: string, reason: string) {
    const post = await this.posts.findOne({ where: { id, status: 'visible' } });
    if (!post) this.missing('Không tìm thấy bài.');
    try {
      const saved = await this.reports.save(
        this.reports.create({
          postId: post.id,
          reporterId: userId,
          reason: plainText(reason),
          status: 'open',
        }),
      );
      return { id: saved.id };
    } catch (error) {
      if (isUnique(error)) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Bạn đã báo cáo bài này.',
          null,
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async setTopicStatus(
    actor: Principal,
    id: string,
    status: TopicStatus,
    reason: string,
    ip: string | null,
  ) {
    const topic = await this.topics.findOne({ where: { id } });
    if (!topic) this.missing('Không tìm thấy chủ đề.');
    const before = topic.status;
    topic.status = status;
    await this.topics.save(topic);
    await this.audit(actor, 'discussion_topic_status', topic.id, reason, ip, {
      before,
      after: status,
    });
    return this.topicView(topic);
  }

  async hidePost(
    actor: Principal,
    id: string,
    hidden: boolean,
    reason: string,
    ip: string | null,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const post = await manager.findOne(DiscussionPostEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post || post.status === 'deleted') this.missing('Không tìm thấy bài.');
      const next: PostStatus = hidden ? 'hidden' : 'visible';
      if (post.rootId && post.status !== next) {
        await manager.increment(
          DiscussionPostEntity,
          { id: post.rootId },
          'replyCount',
          next === 'visible' ? 1 : -1,
        );
      }
      post.status = next;
      await manager.save(post);
      if (hidden) {
        await manager.update(
          DiscussionReportEntity,
          { postId: post.id, status: 'open' },
          { status: 'resolved' },
        );
      }
    });
    await this.audit(actor, 'discussion_post_hide', id, reason, ip, { hidden });
    return { id, hidden };
  }

  async listReports() {
    const rows = await this.reports.find({
      where: { status: 'open' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const postIds = rows.map((row) => row.postId);
    const reporterIds = rows.map((row) => row.reporterId);
    const posts = postIds.length
      ? await this.posts.find({ where: { id: In(postIds) }, withDeleted: true })
      : [];
    const topicIds = [...new Set(posts.map((post) => post.topicId))];
    const topics = topicIds.length
      ? await this.topics.find({ where: { id: In(topicIds) } })
      : [];
    const people = reporterIds.length
      ? await this.users.find({ where: { id: In(reporterIds) } })
      : [];
    return rows.map((row) => {
      const post = posts.find((item) => item.id === row.postId);
      const topic = topics.find((item) => item.id === post?.topicId);
      const reporter = people.find((item) => item.id === row.reporterId);
      return {
        id: row.id,
        postId: row.postId,
        topicId: topic?.id ?? null,
        topicName: topic?.name ?? '',
        body: post?.body ?? '',
        reason: row.reason,
        reporterName: reporter?.displayName ?? '',
        createdAt: row.createdAt,
      };
    });
  }

  async prepareMedia(userId: string, input: CreateMediaDto) {
    await this.consume(userId, 'media');
    const max = input.contentType === 'video/mp4' ? VIDEO_MAX : IMAGE_MAX;
    if (input.byteSize > max) {
      throw new BusinessException(
        ErrorCode.FILE_TOO_LARGE,
        input.contentType === 'video/mp4'
          ? 'Video vượt 50 MB.'
          : 'Ảnh vượt 8 MB.',
        null,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    const id = uuidv7();
    const saved = await this.media.save(
      this.media.create({
        id,
        postId: null,
        authorId: userId,
        objectKey: `discussions/${userId}/${id}`,
        contentType: input.contentType,
        byteSize: input.byteSize,
        kind: input.contentType === 'video/mp4' ? 'video' : 'image',
        status: 'pending',
        sortOrder: 0,
      }),
    );
    const uploadUrl = await this.storage.getPresignedPutUrl(
      saved.objectKey,
      saved.contentType,
    );
    return { id: saved.id, uploadUrl };
  }

  async completeMedia(userId: string, id: string) {
    const row = await this.media.findOne({ where: { id, authorId: userId } });
    if (!row || row.status === 'rejected') this.missing('Không tìm thấy tệp.');
    const head = await this.storage.getObjectRange(row.objectKey, 16);
    if (!sniffMedia(head, row.contentType)) {
      row.status = 'rejected';
      await this.media.save(row);
      throw new BusinessException(
        ErrorCode.INVALID_FILE_TYPE,
        'Nội dung tệp không khớp loại đã khai.',
        null,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    row.status = 'ready';
    await this.media.save(row);
    return { id: row.id, status: row.status };
  }

  async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - CLEANUP_MS);
    const gone = await this.posts.find({
      withDeleted: true,
      where: { status: 'deleted', deletedAt: LessThan(cutoff) },
      take: 40,
    });
    const ids = gone.map((post) => post.id);
    if (!ids.length) return;
    const files = await this.media.find({ where: { postId: In(ids) } });
    for (const file of files) {
      await this.storage.deleteObject(file.objectKey);
      file.deletedAt = new Date();
      await this.media.save(file);
    }
  }

  private async pageTopics(query: string | undefined, cursor: string | undefined) {
    const qb = this.topics
      .createQueryBuilder('topic')
      .where('topic.status = :status', { status: 'open' })
      .orderBy('topic.createdAt', 'DESC')
      .addOrderBy('topic.id', 'DESC')
      .take(PAGE + 1);
    if (query) qb.andWhere('topic.name ILIKE :query', { query: `%${query}%` });
    const point = readCursor(cursor);
    if (point) {
      qb.andWhere(
        '(topic.createdAt < :at OR (topic.createdAt = :at AND topic.id < :id))',
        point,
      );
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > PAGE;
    const slice = hasMore ? rows.slice(0, PAGE) : rows;
    const last = slice.at(-1);
    return {
      items: slice.map((topic) => this.topicView(topic)),
      nextCursor: hasMore && last ? writeCursor(last.createdAt, last.id) : null,
    };
  }

  private async pagePosts(
    cursor: string | undefined,
    topicId: string | null,
    viewerId: string,
  ) {
    const qb = this.posts
      .createQueryBuilder('post')
      .where('post.rootId IS NULL')
      .andWhere('post.status = :status', { status: 'visible' })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(PAGE + 1);
    if (topicId) qb.andWhere('post.topicId = :topicId', { topicId });
    const point = readCursor(cursor);
    if (point) {
      qb.andWhere(
        '(post.createdAt < :at OR (post.createdAt = :at AND post.id < :id))',
        point,
      );
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > PAGE;
    const slice = hasMore ? rows.slice(0, PAGE) : rows;
    const last = slice.at(-1);
    return {
      items: await this.present(slice, viewerId),
      nextCursor: hasMore && last ? writeCursor(last.createdAt, last.id) : null,
    };
  }

  private async present(posts: DiscussionPostEntity[], viewerId: string): Promise<PostView[]> {
    if (!posts.length) return [];
    const userIds = [...new Set(posts.map((post) => post.authorId))];
    const topicIds = [...new Set(posts.map((post) => post.topicId))];
    const parentIds = posts.flatMap((post) => (post.parentId ? [post.parentId] : []));
    const postIds = posts.map((post) => post.id);
    const [people, topics, parents, files, liked] = await Promise.all([
      this.users.find({ where: { id: In(userIds) } }),
      this.topics.find({ where: { id: In(topicIds) } }),
      parentIds.length
        ? this.posts.find({ where: { id: In(parentIds) }, withDeleted: true })
        : Promise.resolve([]),
      this.media.find({
        where: { postId: In(postIds), status: 'ready' },
        order: { sortOrder: 'ASC' },
      }),
      viewerId
        ? this.likes.find({ where: { userId: viewerId, postId: In(postIds) } })
        : Promise.resolve([]),
    ]);
    const parentAuthorIds = parents.map((post) => post.authorId);
    const extra = parentAuthorIds.filter((id) => !userIds.includes(id));
    const morePeople = extra.length
      ? await this.users.find({ where: { id: In(extra) } })
      : [];
    const names = new Map(
      [...people, ...morePeople].map((user) => [user.id, user]),
    );
    return Promise.all(
      posts.map(async (post) => {
        const author = names.get(post.authorId);
        const topic = topics.find((item) => item.id === post.topicId);
        const parent = parents.find((item) => item.id === post.parentId);
        const parentAuthor = parent ? names.get(parent.authorId) : undefined;
        const ownFiles = files.filter((file) => file.postId === post.id);
        const media = await Promise.all(
          ownFiles.map(async (file) => ({
            id: file.id,
            kind: file.kind,
            contentType: file.contentType,
            url: await this.storage.getPresignedUrl(file.objectKey, 3600),
          })),
        );
        return {
          id: post.id,
          authorId: post.authorId,
          authorName: author?.displayName ?? 'Người dùng',
          authorUsername: author?.username ?? null,
          topicId: post.topicId,
          topicSlug: topic?.slug ?? '',
          topicName: topic?.name ?? '',
          rootId: post.rootId,
          parentId: post.parentId,
          parentAuthorName: parentAuthor?.displayName ?? null,
          kind: post.kind,
          body: post.body,
          replyCount: post.replyCount,
          likeCount: post.likeCount,
          likedByMe: liked.some((row) => row.postId === post.id),
          createdAt: post.createdAt,
          media,
        };
      }),
    );
  }

  private async takeMedia(
    manager: DataSource['manager'],
    userId: string,
    ids: string[] | undefined,
  ): Promise<DiscussionMediaEntity[]> {
    if (!ids?.length) return [];
    const rows = await manager.find(DiscussionMediaEntity, {
      where: { id: In(ids), authorId: userId, status: 'ready', postId: IsNull() },
    });
    if (rows.length !== new Set(ids).size) {
      this.invalid('Có tệp chưa sẵn sàng hoặc không phải của bạn.');
    }
    const videos = rows.filter((row) => row.kind === 'video').length;
    const images = rows.filter((row) => row.kind === 'image').length;
    if (videos > 1 || (videos > 0 && images > 0)) {
      this.invalid('Một bài chỉ có 4 ảnh hoặc một video.');
    }
    const order = new Map(ids.map((id, index) => [id, index]));
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  private async attach(
    manager: DataSource['manager'],
    postId: string,
    files: DiscussionMediaEntity[],
  ): Promise<void> {
    for (const [index, file] of files.entries()) {
      file.postId = postId;
      file.sortOrder = index;
      await manager.save(file);
    }
  }

  private async setLike(userId: string, id: string, on: boolean) {
    const count = await this.dataSource.transaction(async (manager) => {
      const post = await manager.findOne(DiscussionPostEntity, {
        where: { id, status: 'visible' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post) this.missing('Không tìm thấy bài.');
      const existing = await manager.findOne(DiscussionLikeEntity, {
        where: { postId: id, userId },
      });
      if (on && !existing) {
        await manager.save(manager.create(DiscussionLikeEntity, { postId: id, userId }));
        post.likeCount += 1;
      }
      if (!on && existing) {
        await manager.delete(DiscussionLikeEntity, { postId: id, userId });
        post.likeCount = Math.max(0, post.likeCount - 1);
      }
      await manager.save(post);
      return post.likeCount;
    });
    return { likeCount: count };
  }

  private requireBody(value: string): string {
    const body = plainText(value);
    if (!body) this.invalid('Nội dung không được để trống.');
    if (body.length > 2000) this.invalid('Nội dung dài hơn 2000 ký tự.');
    return body;
  }

  private topicView(topic: DiscussionTopicEntity) {
    return {
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      summary: topic.summary,
      status: topic.status,
      createdAt: topic.createdAt,
    };
  }

  private async consume(
    userId: string,
    kind: keyof typeof LIMITS,
  ): Promise<void> {
    const rule = LIMITS[kind];
    try {
      const key = `discussion:${kind}:${userId}`;
      const count = await this.redis.getClient().incr(key);
      if (count === 1) await this.redis.getClient().expire(key, rule.window);
      if (count > rule.max) {
        throw new BusinessException(
          ErrorCode.TOO_MANY_REQUESTS,
          'Bạn thao tác quá nhanh. Hãy đợi rồi thử lại.',
          null,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      throw new BusinessException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Chưa ghi được lúc này. Hãy thử lại.',
        null,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async audit(
    actor: Principal,
    action: string,
    targetId: string,
    reason: string,
    ip: string | null,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.audits.save(
      this.audits.create({
        actorId: actor.userId,
        actorType: 'admin',
        action,
        targetType: 'discussion',
        targetId,
        before: null,
        after,
        reason,
        ipAddress: ip,
        sessionId: actor.sessionId,
      }),
    );
  }

  private missing(message: string): never {
    throw new BusinessException(ErrorCode.NOT_FOUND, message, null, HttpStatus.NOT_FOUND);
  }

  private invalid(message: string): never {
    throw new BusinessException(
      ErrorCode.VALIDATION_ERROR,
      message,
      null,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

function writeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
}

function readCursor(cursor?: string): { at: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const text = Buffer.from(cursor, 'base64url').toString('utf8');
    const [iso, id] = text.split('|');
    const at = new Date(iso ?? '');
    if (!id || Number.isNaN(at.getTime())) return null;
    return { at, id };
  } catch {
    return null;
  }
}

function isUnique(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error.driverError as { code?: string } | undefined)?.code;
  return code === '23505';
}
