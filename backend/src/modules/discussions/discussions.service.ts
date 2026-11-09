import { HttpStatus, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, QueryFailedError, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { presentAvatarUrl } from '../auth/avatar-url.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { NotificationsService } from '../notification/notification.service.js';
import { UserRole } from '../rbac/authorization.types.js';
import { Principal } from '../rbac/authorization.types.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { MESSAGING_KEYS } from '../messaging/messaging.constants.js';
import { plainText, sniffMedia, stripMarkup } from './discussion-text.js';
import {
  CreateMediaDto,
  CreatePostDto,
  CreateReplyDto,
  CreateTopicDto,
  PostSettingsDto,
  ReportPostDto,
  ResolveReportDto,
} from './dto/discussion.dto.js';
import { DiscussionBookmarkEntity } from './entities/discussion-bookmark.entity.js';
import { DiscussionLikeEntity } from './entities/discussion-like.entity.js';
import { DiscussionReportEntity, type DiscussionReportStatus } from './entities/discussion-report.entity.js';
import {
  DiscussionMediaEntity,
  MediaKind,
} from './entities/discussion-media.entity.js';
import {
  DiscussionPostEntity,
  PostStatus,
  PostVisibility,
} from './entities/discussion-post.entity.js';
import {
  DiscussionTopicEntity,
  TopicStatus,
} from './entities/discussion-topic.entity.js';

const PAGE = 20;
/** Độ dài tối đa của nội dung (gồm markup), khớp cột varchar(2000). */
const BODY_MAX = 2000;
/** Tối đa ảnh + video trong một bài (trộn được). */
const MEDIA_MAX = 10;
/** Bài không chọn chủ đề vào đây (tự tạo lần đầu). */
const DEFAULT_TOPIC = { slug: 'thao-luan-chung', name: 'Thảo luận chung', summary: 'Bài không thuộc chủ đề riêng.' };
/** Hẹn giờ đăng: sớm nhất 2 phút, muộn nhất 30 ngày. */
const SCHEDULE_MIN_MS = 2 * 60 * 1000;
const SCHEDULE_MAX_MS = 30 * 24 * 60 * 60 * 1000;
/** Một người xem tính một lượt xem cho mỗi bài trong 24 giờ. */
const VIEW_DEDUPE_SECONDS = 24 * 60 * 60;
const FEED_PAGE = 6;
/** Số bình luận của người mình theo dõi hiện sẵn dưới mỗi bài ở feed; phần còn lại xem trong chi tiết bài. */
const FOLLOWED_REPLY_PREVIEW = 3;
const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;
const CLEANUP_MS = 7 * 24 * 60 * 60 * 1000;

const LIMITS = {
  topic: { window: 24 * 60 * 60, max: 5 },
  post: { window: 60 * 60, max: 20 },
  media: { window: 60 * 60, max: 30 },
  bookmark: { window: 60, max: 60 },
  report: { window: 60 * 60, max: 20 },
} as const;

/**
 * Người xem thấy được bài gốc theo `visibility`: tác giả luôn thấy; public cho mọi người; followers cho người đang
 * theo dõi tác giả; friends cho người theo dõi lẫn nhau; private chỉ tác giả. Cần tham số `:viewerId`.
 */
const CAN_SEE = (alias: string): string => `(${alias}.author_id = :viewerId OR ${alias}.visibility = 'public'
  OR (${alias}.visibility = 'followers' AND EXISTS (SELECT 1 FROM user_follows vf WHERE vf.follower_id = :viewerId AND vf.followee_id = ${alias}.author_id))
  OR (${alias}.visibility = 'friends' AND EXISTS (SELECT 1 FROM user_follows vf1 WHERE vf1.follower_id = :viewerId AND vf1.followee_id = ${alias}.author_id)
      AND EXISTS (SELECT 1 FROM user_follows vf2 WHERE vf2.follower_id = ${alias}.author_id AND vf2.followee_id = :viewerId)))`;

/**
 * Ẩn bài của người mình đã chặn và của người đã chặn mình (dùng chung bảng user_blocks với nhắn tin).
 * `alias` là bí danh bài trong query builder.
 */
const NOT_BLOCKED = (alias: string): string =>
  `NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.blocker_id = :viewerId AND ub.blocked_id = ${alias}.author_id) OR (ub.blocker_id = ${alias}.author_id AND ub.blocked_id = :viewerId))`;

export interface ReportView {
  id: string;
  reason: string;
  note: string;
  status: DiscussionReportStatus;
  createdAt: Date;
  /** Số người đã báo cáo cùng bài. */
  reportCount: number;
  post: { id: string; body: string; status: PostStatus; authorName: string; authorUsername: string | null; rootId: string | null } | null;
  reporterName: string;
}

/** Bài ở feed kèm bình luận của những người người xem đang theo dõi (mới nhất trước, hiển thị theo thứ tự thời gian). */
export interface FeedPostView extends PostView {
  followedReplies: PostView[];
  /** Tổng số bình luận của người đang theo dõi (có thể lớn hơn số hiển thị). */
  followedReplyTotal: number;
}

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
  authorAvatarUrl: string | null;
  topicId: string;
  topicSlug: string;
  topicName: string;
  rootId: string | null;
  parentId: string | null;
  parentAuthorName: string | null;
  kind: DiscussionPostEntity['kind'];
  body: string;
  replyCount: number;
  likedByMe: boolean;
  /** Người xem đã lưu bài này. */
  savedByMe: boolean;
  /** null khi tác giả ẩn số lượt thích (người xem không phải tác giả). */
  likeCount: number | null;
  /** null khi tác giả ẩn số lượt xem (người xem không phải tác giả). */
  viewCount: number | null;
  visibility: PostVisibility;
  repliesAllowed: boolean;
  hideLikeCount: boolean;
  hideViewCount: boolean;
  allowShare: boolean;
  /** Giờ hẹn đăng (chỉ tác giả thấy, khi bài còn chờ). */
  scheduledFor: Date | null;
  /**
   * Tác giả đang trực tuyến. Chỉ true khi cả người xem lẫn tác giả đều bật "hiện trạng thái hoạt động" (như nhắn
   * tin); một bên tắt thì luôn false.
   */
  authorOnline: boolean;
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
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AdminAuditLogEntity)
    private readonly audits: Repository<AdminAuditLogEntity>,
    @InjectRepository(DiscussionBookmarkEntity)
    private readonly bookmarks: Repository<DiscussionBookmarkEntity>,
    @InjectRepository(DiscussionReportEntity)
    private readonly reports: Repository<DiscussionReportEntity>,
    private readonly notifications: NotificationsService,
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

  async listPosts(viewerId: string, cursor?: string, followingOnly = false) {
    return this.pagePosts(cursor, null, viewerId, undefined, followingOnly);
  }

  async listAuthorPosts(
    username: string,
    viewerId: string,
    cursor?: string,
    sort: 'newest' | 'interactions' | 'oldest' = 'newest',
  ) {
    const author = await this.users.findOne({ where: { username } });
    if (!author) this.missing('Không tìm thấy người dùng.');
    return this.pagePosts(cursor, null, viewerId, author.id, false, sort);
  }

  async createPost(userId: string, input: CreatePostDto): Promise<PostView> {
    await this.consume(userId, 'post');
    const body = this.requireBody(input.body);
    const publishAt = this.schedule(input.publishAt);
    const saved = await this.dataSource.transaction(async (manager) => {
      const topic = await this.topicForPost(manager, userId, input.topicSlug);
      const files = await this.takeMedia(manager, userId, input.mediaIds);
      const post = await manager.save(
        manager.create(DiscussionPostEntity, {
          authorId: userId,
          topicId: topic.id,
          rootId: null,
          parentId: null,
          kind: input.kind,
          body,
          status: publishAt ? 'scheduled' : 'visible',
          publishAt,
          replyCount: 0,
          likeCount: 0,
          viewCount: 0,
          visibility: input.visibility ?? 'public',
          repliesAllowed: input.repliesAllowed ?? true,
          hideLikeCount: input.hideLikeCount ?? false,
          hideViewCount: input.hideViewCount ?? false,
          allowShare: input.allowShare ?? true,
        }),
      );
      await this.attach(manager, post.id, files);
      return post;
    });
    const [view] = await this.present([saved], userId);
    return view;
  }

  /** Sửa cài đặt bài gốc của chính mình (ai xem, trả lời, ẩn lượt thích/xem, chia sẻ). */
  async updateSettings(userId: string, id: string, input: PostSettingsDto): Promise<PostView> {
    const post = await this.posts.findOne({ where: { id, authorId: userId, rootId: IsNull() } });
    if (!post || (post.status !== 'visible' && post.status !== 'scheduled')) this.missing('Không tìm thấy bài của bạn.');
    if (input.visibility !== undefined) post.visibility = input.visibility;
    if (input.repliesAllowed !== undefined) post.repliesAllowed = input.repliesAllowed;
    if (input.hideLikeCount !== undefined) post.hideLikeCount = input.hideLikeCount;
    if (input.hideViewCount !== undefined) post.hideViewCount = input.hideViewCount;
    if (input.allowShare !== undefined) post.allowShare = input.allowShare;
    const [view] = await this.present([await this.posts.save(post)], userId);
    return view;
  }

  /** Bài đã hẹn giờ của chính mình, sắp đăng trước. */
  async listScheduled(userId: string) {
    const rows = await this.posts.find({
      where: { authorId: userId, status: 'scheduled', rootId: IsNull() },
      order: { publishAt: 'ASC' },
      take: 50,
    });
    return { items: await this.present(rows, userId), nextCursor: null };
  }

  /** Đăng các bài đã tới giờ hẹn; thời gian đăng = giờ hẹn để xếp đúng chỗ trong feed. */
  async publishDue(): Promise<number> {
    const result: [unknown[], number] | unknown[] = await this.dataSource.query(
      `UPDATE discussion_posts SET status = 'visible', created_at = publish_at, updated_at = now()
       WHERE status = 'scheduled' AND publish_at <= now()`,
    );
    return Array.isArray(result) && typeof result[1] === 'number' ? result[1] : 0;
  }

  /** Tính một lượt xem (mỗi người một lần trong 24 giờ, không tính tác giả). */
  async recordView(viewerId: string, id: string): Promise<{ counted: boolean }> {
    const post = await this.posts.findOne({ where: { id, status: 'visible', rootId: IsNull() } });
    if (!post || !(await this.canSee(viewerId, post))) this.missing('Không tìm thấy bài.');
    if (post.authorId === viewerId) return { counted: false };
    try {
      const fresh = await this.redis
        .getClient()
        .set(`discussion:view:${id}:${viewerId}`, '1', 'EX', VIEW_DEDUPE_SECONDS, 'NX');
      if (fresh !== 'OK') return { counted: false };
    } catch {
      return { counted: false };
    }
    await this.posts.increment({ id }, 'viewCount', 1);
    return { counted: true };
  }

  async getThread(id: string, viewerId: string, cursor?: string) {
    const root = await this.posts.findOne({ where: { id, rootId: IsNull(), status: 'visible' } });
    if (!root || !(await this.canSee(viewerId, root))) this.missing('Không tìm thấy bài.');
    const qb = this.posts
      .createQueryBuilder('post')
      .where('post.rootId = :rootId', { rootId: root.id })
      .andWhere('post.status = :status', { status: 'visible' })
      .andWhere(NOT_BLOCKED('post'), { viewerId })
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
      if (!root || root.status !== 'visible' || !(await this.canSee(userId, root))) this.missing('Không tìm thấy bài.');
      if (!root.repliesAllowed && root.authorId !== userId) this.invalid('Tác giả đã tắt trả lời cho bài này.');
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
          viewCount: 0,
          visibility: 'public',
        }),
      );
      root.replyCount += 1;
      await manager.save(root);
      await this.attach(manager, post.id, files);
      return post;
    });
    const [view] = await this.present([saved], userId);
    if (saved.rootId) {
      const root = await this.posts.findOne({ where: { id: saved.rootId } });
      if (root && root.authorId !== userId) {
        const [actor, author] = await Promise.all([
          this.users.findOne({ where: { id: userId } }),
          this.users.findOne({ where: { id: root.authorId } }),
        ]);
        const rootPath = author?.role === UserRole.ADMIN ? '/admin' : '/app';
        void this.notifications.notify({
          userId: root.authorId,
          type: 'discussion.reply',
          link: `${rootPath}/feed/${root.id}`,
          params: { actorName: actor?.displayName ?? 'Một người dùng', preview: stripMarkup(saved.body).slice(0, 80) },
          actorId: userId,
          collapseKey: `discussion.reply:${root.id}`,
        });
      }
    }
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

  /** Lưu / bỏ lưu một bài (idempotent). Chỉ lưu được bài đang hiện. */
  async setBookmark(userId: string, id: string, on: boolean): Promise<{ saved: boolean }> {
    await this.consume(userId, 'bookmark');
    if (on) {
      const post = await this.posts.findOne({ where: { id, status: 'visible' } });
      if (!post || !(await this.canSee(userId, post))) this.missing('Không tìm thấy bài.');
      await this.bookmarks
        .createQueryBuilder()
        .insert()
        .values({ userId, postId: id })
        .orIgnore()
        .execute();
    } else {
      await this.bookmarks.delete({ userId, postId: id });
    }
    return { saved: on };
  }

  /** Bài đã lưu, mới lưu trước; bỏ qua bài đã bị ẩn/xóa và bài của người bị chặn. */
  async listBookmarks(viewerId: string, cursor?: string) {
    const qb = this.bookmarks
      .createQueryBuilder('b')
      .innerJoin(DiscussionPostEntity, 'post', 'post.id = b.postId')
      .where('b.userId = :viewerId', { viewerId })
      .andWhere('post.status = :status', { status: 'visible' })
      .andWhere(NOT_BLOCKED('post'), { viewerId })
      .andWhere(CAN_SEE('post'), { viewerId })
      .orderBy('b.createdAt', 'DESC')
      .addOrderBy('b.postId', 'DESC')
      // limit (không phải take): có join nên take sẽ dựng truy vấn phân trang hai bước không cần thiết.
      .limit(PAGE + 1);
    const point = readCursor(cursor);
    if (point) {
      qb.andWhere('(b.createdAt < :at OR (b.createdAt = :at AND b.postId < :id))', point);
    }
    const marks = await qb.getMany();
    const hasMore = marks.length > PAGE;
    const slice = hasMore ? marks.slice(0, PAGE) : marks;
    const rows = slice.length ? await this.posts.find({ where: { id: In(slice.map((mark) => mark.postId)) } }) : [];
    const ordered = slice.flatMap((mark) => rows.filter((row) => row.id === mark.postId));
    const last = slice.at(-1);
    return {
      items: await this.withFollowedReplies(await this.present(ordered, viewerId), viewerId),
      nextCursor: hasMore && last ? writeCursor(last.createdAt, last.postId) : null,
    };
  }

  /** Báo cáo bài của người khác. Báo lại cùng bài thì cập nhật lý do và mở lại nếu đã đóng. */
  async report(userId: string, id: string, input: ReportPostDto): Promise<{ reported: true }> {
    await this.consume(userId, 'report');
    const post = await this.posts.findOne({ where: { id, status: 'visible' } });
    if (!post || !(await this.canSee(userId, post))) this.missing('Không tìm thấy bài.');
    if (post.authorId === userId) this.invalid('Không thể báo cáo bài của chính mình.');
    const note = plainText(input.note ?? '').slice(0, 500);
    await this.reports
      .createQueryBuilder()
      .insert()
      .values({ postId: id, reporterId: userId, reason: input.reason, note, status: 'open' })
      .orUpdate(['reason', 'note', 'status', 'updated_at'], ['post_id', 'reporter_id'])
      .execute();
    return { reported: true };
  }

  /** Danh sách báo cáo cho kiểm duyệt (mới nhất trước), kèm tóm tắt bài và số lượt báo cáo của bài. */
  async listReports(status: DiscussionReportStatus = 'open'): Promise<ReportView[]> {
    const rows = await this.reports.find({ where: { status }, order: { createdAt: 'DESC' }, take: 100 });
    if (!rows.length) return [];
    const postIds = [...new Set(rows.map((row) => row.postId))];
    const [posts, counts] = await Promise.all([
      this.posts.find({ where: { id: In(postIds) }, withDeleted: true }),
      this.reports
        .createQueryBuilder('r')
        .select('r.post_id', 'postId')
        .addSelect('COUNT(*)::int', 'count')
        .where('r.post_id IN (:...postIds)', { postIds })
        .groupBy('r.post_id')
        .getRawMany<{ postId: string; count: number }>(),
    ]);
    const people = await this.users.find({
      where: { id: In([...new Set([...rows.map((row) => row.reporterId), ...posts.map((post) => post.authorId)])]) },
    });
    const person = (id: string) => people.find((user) => user.id === id);
    return rows.map((row) => {
      const post = posts.find((item) => item.id === row.postId);
      const author = post ? person(post.authorId) : undefined;
      return {
        id: row.id,
        reason: row.reason,
        note: row.note,
        status: row.status,
        createdAt: row.createdAt,
        reportCount: counts.find((item) => item.postId === row.postId)?.count ?? 1,
        post: post
          ? {
              id: post.id,
              body: post.body.slice(0, 280),
              status: post.status,
              authorName: author?.displayName ?? 'Người dùng',
              authorUsername: author?.username ?? null,
              rootId: post.rootId,
            }
          : null,
        reporterName: person(row.reporterId)?.displayName ?? 'Người dùng',
      };
    });
  }

  /**
   * Xử lý báo cáo: `actioned` ẩn bài (ghi nhật ký kiểm duyệt) và đóng mọi báo cáo mở của bài đó; `dismissed` chỉ
   * đóng báo cáo này.
   */
  async resolveReport(actor: Principal, reportId: string, input: ResolveReportDto, ip: string | null) {
    const row = await this.reports.findOne({ where: { id: reportId } });
    if (!row) this.missing('Không tìm thấy báo cáo.');
    if (input.status === 'actioned') {
      await this.hidePost(actor, row.postId, true, input.reason, ip);
      await this.reports.update({ postId: row.postId, status: 'open' }, { status: 'actioned', resolvedBy: actor.userId });
    } else {
      await this.reports.update({ id: row.id }, { status: 'dismissed', resolvedBy: actor.userId });
      await this.audit(actor, 'discussion_report_dismiss', row.postId, input.reason, ip, { reportId });
    }
    return { id: reportId, status: input.status };
  }

  /** Người xem có được thấy bài gốc này không (cùng quy tắc CAN_SEE). Trả lời theo quyền của bài gốc. */
  private async canSee(viewerId: string, post: DiscussionPostEntity): Promise<boolean> {
    if (post.authorId === viewerId || post.visibility === 'public') return true;
    if (post.visibility === 'private') return false;
    const rows: Array<{ follows: boolean; followed: boolean }> = await this.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM user_follows WHERE follower_id = $1 AND followee_id = $2) AS follows,
              EXISTS (SELECT 1 FROM user_follows WHERE follower_id = $2 AND followee_id = $1) AS followed`,
      [viewerId, post.authorId],
    );
    const relation = rows[0];
    if (!relation?.follows) return false;
    return post.visibility === 'followers' || Boolean(relation.followed);
  }

  /** Chủ đề cho bài mới: theo slug (phải đang mở), không có thì chủ đề mặc định (tự tạo lần đầu). */
  private async topicForPost(manager: DataSource['manager'], userId: string, slug: string | undefined): Promise<DiscussionTopicEntity> {
    if (slug) {
      const topic = await manager.findOne(DiscussionTopicEntity, { where: { slug }, lock: { mode: 'pessimistic_write' } });
      if (!topic || topic.status !== 'open') this.invalid('Chủ đề không còn nhận bài mới.');
      return topic;
    }
    await manager
      .createQueryBuilder()
      .insert()
      .into(DiscussionTopicEntity)
      .values({ id: uuidv7(), slug: DEFAULT_TOPIC.slug, name: DEFAULT_TOPIC.name, summary: DEFAULT_TOPIC.summary, authorId: userId, status: 'open' })
      .orIgnore()
      .execute();
    const topic = await manager.findOne(DiscussionTopicEntity, { where: { slug: DEFAULT_TOPIC.slug } });
    if (!topic || topic.status !== 'open') this.invalid('Hãy chọn một chủ đề.');
    return topic;
  }

  /** Giờ hẹn hợp lệ hoặc null (đăng ngay). */
  private schedule(value: string | undefined): Date | null {
    if (!value) return null;
    const at = new Date(value);
    const delta = at.getTime() - Date.now();
    if (!Number.isFinite(at.getTime()) || delta < SCHEDULE_MIN_MS || delta > SCHEDULE_MAX_MS) {
      this.invalid('Giờ hẹn đăng phải từ 2 phút tới 30 ngày kể từ bây giờ.');
    }
    return at;
  }

  /** Làm mới chấm trực tuyến cho các tác giả đang hiện trên màn hình (tối đa 50), cùng quy tắc riêng tư. */
  async presence(viewerId: string, userIds: string[]): Promise<{ online: string[] }> {
    const ids = [...new Set(userIds)].slice(0, 50);
    return { online: [...(await this.onlineAmong(viewerId, ids))] };
  }

  /**
   * Ai trong `userIds` đang trực tuyến mà người xem được phép thấy: dùng chung khóa presence của nhắn tin (Redis,
   * TTL 90 s, làm mới qua kết nối realtime) và tùy chọn `show_activity_status` (không có hàng = bật). Hai chiều:
   * người xem tắt thì không thấy ai. Người bị chặn đã bị lọc khỏi feed trước đó. Redis lỗi thì coi như không ai.
   */
  private async onlineAmong(viewerId: string, userIds: string[]): Promise<Set<string>> {
    if (!viewerId || userIds.length === 0) return new Set();
    try {
      const rows: Array<{ user_id: string; show_activity_status: boolean }> = await this.dataSource.query(
        'SELECT user_id, show_activity_status FROM messaging_preferences WHERE user_id = ANY($1::uuid[])',
        [[viewerId, ...userIds]],
      );
      const hidden = new Set(rows.filter((row) => !row.show_activity_status).map((row) => row.user_id));
      if (hidden.has(viewerId)) return new Set();
      const candidates = userIds.filter((id) => !hidden.has(id));
      if (candidates.length === 0) return new Set();
      const pipeline = this.redis.getClient().pipeline();
      for (const id of candidates) pipeline.exists(MESSAGING_KEYS.online(id));
      const results = (await pipeline.exec()) ?? [];
      return new Set(candidates.filter((_, index) => Number(results[index]?.[1] ?? 0) > 0));
    } catch {
      return new Set();
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
    });
    await this.audit(actor, 'discussion_post_hide', id, reason, ip, { hidden });
    return { id, hidden };
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
    authorId?: string,
    followingOnly = false,
    sort: 'newest' | 'interactions' | 'oldest' = 'newest',
  ) {
    const qb = this.posts
      .createQueryBuilder('post')
      .where('post.rootId IS NULL')
      .andWhere('post.status = :status', { status: 'visible' })
      .andWhere(NOT_BLOCKED('post'), { viewerId })
      .andWhere(CAN_SEE('post'), { viewerId })
      .take(FEED_PAGE + 1);
    if (sort === 'oldest') {
      qb.orderBy('post.createdAt', 'ASC').addOrderBy('post.id', 'ASC');
    } else if (sort === 'interactions') {
      qb.orderBy('post.likeCount + post.replyCount', 'DESC')
        .addOrderBy('post.createdAt', 'DESC')
        .addOrderBy('post.id', 'DESC');
    } else {
      qb.orderBy('post.createdAt', 'DESC').addOrderBy('post.id', 'DESC');
    }
    if (topicId) qb.andWhere('post.topicId = :topicId', { topicId });
    if (authorId) qb.andWhere('post.authorId = :authorId', { authorId });
    if (followingOnly) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM user_follows f WHERE f.follower_id = :viewerId AND f.followee_id = post.authorId)',
        { viewerId },
      );
    }
    const point = sort === 'newest' ? readCursor(cursor) : undefined;
    if (point) {
      qb.andWhere(
        '(post.createdAt < :at OR (post.createdAt = :at AND post.id < :id))',
        point,
      );
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > FEED_PAGE;
    const slice = hasMore ? rows.slice(0, FEED_PAGE) : rows;
    const last = slice.at(-1);
    return {
      items: await this.withFollowedReplies(await this.present(slice, viewerId), viewerId),
      nextCursor:
        sort === 'newest' && hasMore && last ? writeCursor(last.createdAt, last.id) : null,
    };
  }

  /**
   * Gắn vào mỗi bài của feed các bình luận của người người xem đang theo dõi, để hiện ngay dưới bài mà không cần mở
   * chi tiết. Mỗi người xem thấy khác nhau. Một truy vấn cho cả trang (không N+1): lấy FOLLOWED_REPLY_PREVIEW bình
   * luận mới nhất mỗi bài cùng tổng số. Bài gốc đã qua CAN_SEE nên bình luận (kế thừa quyền của bài gốc) cũng được
   * xem; vẫn loại bình luận bị ẩn/xóa, của người chặn nhau và của chính người xem.
   */
  private async withFollowedReplies(views: PostView[], viewerId: string): Promise<FeedPostView[]> {
    const rootIds = views.filter((view) => view.rootId === null && view.replyCount > 0).map((view) => view.id);
    if (!viewerId || rootIds.length === 0) {
      return views.map((view) => ({ ...view, followedReplies: [], followedReplyTotal: 0 }));
    }
    const rows: Array<{ id: string; root_id: string; total: string }> = await this.dataSource.query(
      `SELECT id, root_id, total FROM (
         SELECT r.id, r.root_id, r.created_at,
                ROW_NUMBER() OVER (PARTITION BY r.root_id ORDER BY r.created_at DESC, r.id DESC) AS rn,
                COUNT(*) OVER (PARTITION BY r.root_id) AS total
           FROM discussion_posts r
           JOIN user_follows f ON f.follower_id = $1 AND f.followee_id = r.author_id
          WHERE r.root_id = ANY($2::uuid[])
            AND r.status = 'visible'
            AND r.deleted_at IS NULL
            AND r.author_id <> $1
            AND NOT EXISTS (
              SELECT 1 FROM user_blocks ub
               WHERE (ub.blocker_id = $1 AND ub.blocked_id = r.author_id)
                  OR (ub.blocker_id = r.author_id AND ub.blocked_id = $1))
       ) ranked
       WHERE rn <= $3
       ORDER BY root_id, created_at ASC, id ASC`,
      [viewerId, rootIds, FOLLOWED_REPLY_PREVIEW],
    );
    if (rows.length === 0) {
      return views.map((view) => ({ ...view, followedReplies: [], followedReplyTotal: 0 }));
    }
    const entities = await this.posts.find({ where: { id: In(rows.map((row) => row.id)) } });
    const presented = await this.present(entities, viewerId);
    const byId = new Map(presented.map((view) => [view.id, view]));
    const grouped = new Map<string, { replies: PostView[]; total: number }>();
    for (const row of rows) {
      const view = byId.get(row.id);
      if (!view) continue;
      const entry = grouped.get(row.root_id) ?? { replies: [], total: Number(row.total) };
      entry.replies.push(view);
      grouped.set(row.root_id, entry);
    }
    return views.map((view) => {
      const entry = grouped.get(view.id);
      return { ...view, followedReplies: entry?.replies ?? [], followedReplyTotal: entry?.total ?? 0 };
    });
  }

  private async present(posts: DiscussionPostEntity[], viewerId: string): Promise<PostView[]> {
    if (!posts.length) return [];
    const userIds = [...new Set(posts.map((post) => post.authorId))];
    const topicIds = [...new Set(posts.map((post) => post.topicId))];
    const parentIds = posts.flatMap((post) => (post.parentId ? [post.parentId] : []));
    const postIds = posts.map((post) => post.id);
    const [people, topics, parents, files, liked, kept] = await Promise.all([
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
      viewerId
        ? this.bookmarks.find({ where: { userId: viewerId, postId: In(postIds) } })
        : Promise.resolve([]),
    ]);
    const online = await this.onlineAmong(viewerId, userIds);
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
          authorAvatarUrl: presentAvatarUrl(author?.avatarUrl),
          topicId: post.topicId,
          topicSlug: topic?.slug ?? '',
          topicName: topic?.name ?? '',
          rootId: post.rootId,
          parentId: post.parentId,
          parentAuthorName: parentAuthor?.displayName ?? null,
          kind: post.kind,
          body: post.body,
          replyCount: post.replyCount,
          likeCount: post.hideLikeCount && post.authorId !== viewerId ? null : post.likeCount,
          viewCount: post.hideViewCount && post.authorId !== viewerId ? null : post.viewCount,
          visibility: post.visibility,
          repliesAllowed: post.repliesAllowed,
          hideLikeCount: post.hideLikeCount,
          hideViewCount: post.hideViewCount,
          allowShare: post.allowShare,
          scheduledFor: post.status === 'scheduled' && post.authorId === viewerId ? post.publishAt : null,
          likedByMe: liked.some((row) => row.postId === post.id),
          savedByMe: kept.some((row) => row.postId === post.id),
          authorOnline: online.has(post.authorId),
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
    if (rows.length > MEDIA_MAX) this.invalid(`Một bài có tối đa ${MEDIA_MAX} ảnh và video.`);
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
      if (!post || !(await this.canSee(userId, post))) this.missing('Không tìm thấy bài.');
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
    if (body.length > BODY_MAX) this.invalid(`Nội dung dài hơn ${BODY_MAX} ký tự.`);
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
