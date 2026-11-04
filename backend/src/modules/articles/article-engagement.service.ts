import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { NotFoundException } from '../../common/exceptions/not-found.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { presentAvatarUrl } from '../auth/avatar-url.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { cleanCommentBody } from './article-rules.js';
import { ArticleCommentLikeEntity } from './entities/article-comment-like.entity.js';
import { ArticleCommentEntity } from './entities/article-comment.entity.js';
import { ArticleVoteEntity } from './entities/article-vote.entity.js';
import { ArticleEntity } from './entities/article.entity.js';

const COMMENT_PAGE_SIZE = 10;
const REPLY_CAP_PER_PAGE = 200;
const COMMENTS_PER_MINUTE = 5;

export type ArticleAuthor = { name: string; username: string | null; avatarUrl: string | null };

export type ArticleStats = { upvotes: number; downvotes: number; comments: number };

export type CommentView = {
  id: string;
  parentId: string | null;
  body: string;
  removed: boolean;
  author: ArticleAuthor | null;
  createdAt: Date;
  editedAt: Date | null;
  likes: number;
  mine: boolean;
};

export type CommentThread = CommentView & { replies: CommentView[] };

/** Người đăng bài do AI tạo hoặc chưa gán người: hiện tên tòa soạn. */
export const EDITORIAL_AUTHOR: ArticleAuthor = { name: 'Địa Thế', username: null, avatarUrl: null };

@Injectable()
export class ArticleEngagementService {
  constructor(
    @InjectRepository(ArticleEntity) private readonly articles: Repository<ArticleEntity>,
    @InjectRepository(ArticleVoteEntity) private readonly votes: Repository<ArticleVoteEntity>,
    @InjectRepository(ArticleCommentEntity) private readonly comments: Repository<ArticleCommentEntity>,
    @InjectRepository(ArticleCommentLikeEntity) private readonly likes: Repository<ArticleCommentLikeEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async authorOf(userId: string | null): Promise<ArticleAuthor> {
    if (!userId) return EDITORIAL_AUTHOR;
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return EDITORIAL_AUTHOR;
    return { name: user.displayName, username: user.username, avatarUrl: presentAvatarUrl(user.avatarUrl) };
  }

  async stats(articleId: string): Promise<ArticleStats> {
    const rows = await this.votes
      .createQueryBuilder('vote')
      .select('vote.value', 'value')
      .addSelect('COUNT(*)', 'count')
      .where('vote.articleId = :articleId', { articleId })
      .groupBy('vote.value')
      .getRawMany<{ value: number; count: string }>();
    const count = (value: number): number => Number(rows.find((row) => Number(row.value) === value)?.count ?? 0);
    const comments = await this.comments.count({ where: { articleId, removed: false } });
    return { upvotes: count(1), downvotes: count(-1), comments };
  }

  async myState(articleId: string, userId: string): Promise<{ myVote: 1 | -1 | 0; likedCommentIds: string[] }> {
    const vote = await this.votes.findOne({ where: { articleId, userId } });
    const mine = await this.comments.find({ where: { articleId }, select: { id: true } });
    const liked = mine.length
      ? await this.likes.find({ where: { userId, commentId: In(mine.map((row) => row.id)) } })
      : [];
    return { myVote: vote ? (vote.value > 0 ? 1 : -1) : 0, likedCommentIds: liked.map((row) => row.commentId) };
  }

  /** value 1/-1 đặt phiếu, 0 bỏ phiếu. Idempotent. */
  async vote(articleId: string, userId: string, value: 1 | -1 | 0): Promise<ArticleStats & { myVote: 1 | -1 | 0 }> {
    if (value === 0) await this.votes.delete({ articleId, userId });
    else await this.votes.upsert({ articleId, userId, value }, ['articleId', 'userId']);
    return { ...(await this.stats(articleId)), myVote: value };
  }

  async list(articleId: string, sort: 'new' | 'top', page: number, viewerId: string | null): Promise<{
    items: CommentThread[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const rootWhere = { articleId, parentId: IsNull() };
    const total = await this.comments.count({ where: rootWhere });
    let roots: ArticleCommentEntity[];
    if (sort === 'top') {
      // Số bình luận gốc của một bài nhỏ nên xếp theo lượt thích ngay trong bộ nhớ, tránh truy vấn phân trang phức tạp.
      const all = await this.comments.find({ where: rootWhere, order: { createdAt: 'DESC' }, take: 500 });
      const counts = await this.likeCounts(all.map((row) => row.id));
      all.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
      roots = all.slice((page - 1) * COMMENT_PAGE_SIZE, page * COMMENT_PAGE_SIZE);
    } else {
      roots = await this.comments.find({
        where: rootWhere,
        order: { createdAt: 'DESC' },
        take: COMMENT_PAGE_SIZE,
        skip: (page - 1) * COMMENT_PAGE_SIZE,
      });
    }
    const replies = roots.length
      ? await this.comments.find({
          where: { articleId, parentId: In(roots.map((row) => row.id)) },
          order: { createdAt: 'ASC' },
          take: REPLY_CAP_PER_PAGE,
        })
      : [];
    const all = [...roots, ...replies];
    const views = await this.present(all, viewerId);
    const byId = new Map(views.map((view) => [view.id, view]));
    return {
      items: roots.map((root) => ({
        ...(byId.get(root.id) as CommentView),
        replies: replies.filter((reply) => reply.parentId === root.id).map((reply) => byId.get(reply.id) as CommentView),
      })),
      page,
      pageSize: COMMENT_PAGE_SIZE,
      total,
    };
  }

  async create(articleId: string, userId: string, rawBody: string, parentId?: string): Promise<CommentView> {
    const body = this.validBody(rawBody);
    let rootId: string | null = null;
    if (parentId) {
      const parent = await this.comments.findOne({ where: { id: parentId, articleId } });
      if (!parent || parent.removed) throw new NotFoundException('Không có bình luận để trả lời.');
      rootId = parent.parentId ?? parent.id;
    }
    const since = new Date(Date.now() - 60_000);
    const recent = await this.comments
      .createQueryBuilder('c')
      .where('c.userId = :userId AND c.createdAt > :since', { userId, since })
      .withDeleted()
      .getCount();
    if (recent >= COMMENTS_PER_MINUTE) {
      throw new BusinessException(
        ErrorCode.TOO_MANY_REQUESTS,
        'Bạn bình luận hơi nhanh, vui lòng thử lại sau ít phút.',
        null,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const saved = await this.comments.save(
      this.comments.create({ articleId, userId, parentId: rootId, body, removed: false, editedAt: null }),
    );
    return (await this.present([saved], userId))[0];
  }

  async edit(id: string, userId: string, rawBody: string): Promise<CommentView> {
    const row = await this.comments.findOne({ where: { id } });
    if (!row || row.removed) throw new NotFoundException('Không có bình luận này.');
    if (row.userId !== userId) throw this.forbidden();
    row.body = this.validBody(rawBody);
    row.editedAt = new Date();
    return (await this.present([await this.comments.save(row)], userId))[0];
  }

  /** Chủ bình luận hoặc quản trị viên. Gốc còn trả lời thì giữ lại làm chỗ trống. */
  async remove(id: string, userId: string, isAdmin: boolean): Promise<{ id: string }> {
    const row = await this.comments.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không có bình luận này.');
    if (row.userId !== userId && !isAdmin) throw this.forbidden();
    const replies = row.parentId ? 0 : await this.comments.count({ where: { parentId: row.id, deletedAt: IsNull() } });
    if (replies > 0) {
      row.removed = true;
      row.body = '';
      await this.comments.save(row);
    } else {
      await this.comments.softDelete(id);
    }
    await this.likes.delete({ commentId: id });
    return { id };
  }

  async like(id: string, userId: string, liked: boolean): Promise<{ id: string; likes: number; liked: boolean }> {
    const row = await this.comments.findOne({ where: { id } });
    if (!row || row.removed) throw new NotFoundException('Không có bình luận này.');
    if (liked) await this.likes.upsert({ commentId: id, userId }, ['commentId', 'userId']);
    else await this.likes.delete({ commentId: id, userId });
    return { id, likes: await this.likes.count({ where: { commentId: id } }), liked };
  }

  async articleIdOfComment(id: string): Promise<string | null> {
    return (await this.comments.findOne({ where: { id } }))?.articleId ?? null;
  }

  private async likeCounts(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.likes
      .createQueryBuilder('l')
      .select('l.commentId', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('l.commentId IN (:...ids)', { ids })
      .groupBy('l.commentId')
      .getRawMany<{ id: string; count: string }>();
    return new Map(rows.map((row) => [row.id, Number(row.count)]));
  }

  private validBody(raw: string): string {
    const body = cleanCommentBody(raw);
    if (body.length < 1 || body.length > 2000) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Bình luận cần từ 1 đến 2000 ký tự.');
    }
    return body;
  }

  private forbidden(): BusinessException {
    return new BusinessException(ErrorCode.FORBIDDEN, 'Bạn không có quyền với bình luận này.', null, HttpStatus.FORBIDDEN);
  }

  private async present(rows: ArticleCommentEntity[], viewerId: string | null): Promise<CommentView[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const [users, likeCount] = await Promise.all([
      this.users.find({ where: { id: In(userIds) } }),
      this.likeCounts(ids),
    ]);
    const byUser = new Map(users.map((user) => [user.id, user]));
    return rows.map((row) => {
      const user = byUser.get(row.userId);
      return {
        id: row.id,
        parentId: row.parentId,
        body: row.removed ? '' : row.body,
        removed: row.removed,
        author: row.removed || !user
          ? null
          : { name: user.displayName, username: user.username, avatarUrl: presentAvatarUrl(user.avatarUrl) },
        createdAt: row.createdAt,
        editedAt: row.editedAt,
        likes: likeCount.get(row.id) ?? 0,
        mine: viewerId !== null && row.userId === viewerId,
      };
    });
  }
}
