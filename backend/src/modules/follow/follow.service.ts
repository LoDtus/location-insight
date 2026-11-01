import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { UserEntity, UserStatus } from '../auth/entities/user.entity.js';
import { rowsOf } from '../messaging/messaging-db.js';
import { invalid, notFound, tooMany, unavailable } from '../messaging/messaging-errors.js';
import { isUuid, readCursor, writeCursor } from '../messaging/messaging-rules.js';
import { UserFollowEntity } from './entities/user-follow.entity.js';

export const FOLLOW_LIMITS = {
  followingMax: 5000,
  actionsPerHour: 60,
  pageDefault: 30,
  pageMax: 50,
  relationshipsMax: 50,
} as const;

export interface Relationship {
  following: boolean;
  followedBy: boolean;
}

export interface FollowState extends Relationship {
  followerCount: number;
  followingCount: number;
  self: boolean;
}

export interface FollowEntry {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  followedByMe: boolean;
  followsMe: boolean;
  followedAt: string;
}

interface Delta {
  userId: string;
  followers: number;
  following: number;
}

@Injectable()
export class FollowService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(UserFollowEntity) private readonly follows: Repository<UserFollowEntity>,
  ) {}

  async state(viewerId: string, targetId: string): Promise<FollowState> {
    await this.requireTarget(targetId);
    return this.stateOf(viewerId, targetId);
  }

  async follow(viewerId: string, targetId: string): Promise<FollowState> {
    if (viewerId === targetId) invalid('Không thể theo dõi chính mình.');
    await this.requireTarget(targetId);
    if (await this.blockedBetween(viewerId, targetId)) {
      throw new BusinessException(
        ErrorCode.PERMISSION_DENIED,
        'Bạn không thể theo dõi người này.',
        { code: 'cannot_follow_user' },
        HttpStatus.FORBIDDEN,
      );
    }
    await this.consume(viewerId);
    if (!(await this.isFollowing(viewerId, targetId))) {
      const stats = await this.counts(viewerId);
      if (stats.followingCount >= FOLLOW_LIMITS.followingMax) {
        throw new BusinessException(
          ErrorCode.LIMIT_REACHED,
          `Bạn chỉ theo dõi được tối đa ${FOLLOW_LIMITS.followingMax} người.`,
          { code: 'limit_reached' },
          HttpStatus.CONFLICT,
        );
      }
    }
    await this.dataSource.transaction(async (manager) => {
      const inserted = rowsOf<{ follower_id: string }>(
        await manager.query(
          `INSERT INTO user_follows (follower_id, followee_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING follower_id`,
          [viewerId, targetId],
        ),
      );
      if (!inserted.length) return;
      await this.bump(manager, [
        { userId: viewerId, followers: 0, following: 1 },
        { userId: targetId, followers: 1, following: 0 },
      ]);
    });
    return this.stateOf(viewerId, targetId);
  }

  async unfollow(viewerId: string, targetId: string): Promise<FollowState> {
    if (viewerId === targetId) invalid('Không thể bỏ theo dõi chính mình.');
    const target = await this.users.findOne({ where: { id: targetId }, withDeleted: true });
    if (!target) notFound('Không tìm thấy người dùng.');
    await this.consume(viewerId);
    await this.dataSource.transaction(async (manager) => {
      const removed = rowsOf<{ follower_id: string }>(
        await manager.query(
          `DELETE FROM user_follows WHERE follower_id = $1 AND followee_id = $2 RETURNING follower_id`,
          [viewerId, targetId],
        ),
      );
      if (!removed.length) return;
      await this.bump(manager, [
        { userId: viewerId, followers: 0, following: -1 },
        { userId: targetId, followers: -1, following: 0 },
      ]);
    });
    return this.stateOf(viewerId, targetId);
  }

  async list(
    kind: 'followers' | 'following',
    viewerId: string,
    targetId: string,
    cursor: string | undefined,
    limit: number = FOLLOW_LIMITS.pageDefault,
  ): Promise<{ items: FollowEntry[]; nextCursor: string | null }> {
    await this.requireTarget(targetId);
    const size = Math.min(limit, FOLLOW_LIMITS.pageMax);
    const edge = kind === 'followers' ? 'follower_id' : 'followee_id';
    const anchor = kind === 'followers' ? 'followee_id' : 'follower_id';
    const point = readCursor(cursor, 2);
    const params: unknown[] = [targetId, viewerId, size + 1];
    let after = '';
    if (point) {
      params.push(point[0], point[1]);
      after = `AND (f.created_at, f.${edge}) < ($4::timestamptz, $5::uuid)`;
    }
    const rows = rowsOf<{
      id: string;
      display_name: string;
      username: string | null;
      avatar_url: string | null;
      followed_by_me: boolean;
      follows_me: boolean;
      at: string;
      cur: string;
    }>(
      await this.dataSource.query(
        `SELECT u.id, u.display_name, u.username, u.avatar_url,
                (vf.follower_id IS NOT NULL) AS followed_by_me,
                (fm.follower_id IS NOT NULL) AS follows_me,
                f.created_at::text AS cur, f.created_at AS at
         FROM user_follows f
         JOIN users u ON u.id = f.${edge} AND u.status = 'active' AND u.deleted_at IS NULL
         LEFT JOIN user_follows vf ON vf.follower_id = $2 AND vf.followee_id = u.id
         LEFT JOIN user_follows fm ON fm.follower_id = u.id AND fm.followee_id = $2
         WHERE f.${anchor} = $1 ${after}
         ORDER BY f.created_at DESC, f.${edge} DESC
         LIMIT $3`,
        params,
      ),
    );
    const hasMore = rows.length > size;
    const slice = hasMore ? rows.slice(0, size) : rows;
    const last = slice.at(-1);
    return {
      items: slice.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        username: row.username,
        avatarUrl: row.avatar_url,
        followedByMe: row.followed_by_me,
        followsMe: row.follows_me,
        followedAt: new Date(row.at).toISOString(),
      })),
      nextCursor: hasMore && last ? writeCursor([last.cur, last.id]) : null,
    };
  }

  async relationships(viewerId: string, rawIds: string): Promise<Record<string, Relationship>> {
    const ids = [...new Set(rawIds.split(',').map((item) => item.trim()).filter(Boolean))];
    if (ids.length === 0 || ids.length > FOLLOW_LIMITS.relationshipsMax || ids.some((id) => !isUuid(id))) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `Cần từ 1 đến ${FOLLOW_LIMITS.relationshipsMax} id hợp lệ.`,
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
    const rows = rowsOf<{ id: string; following: boolean; followed_by: boolean }>(
      await this.dataSource.query(
        `SELECT t.id,
                EXISTS (SELECT 1 FROM user_follows WHERE follower_id = $1 AND followee_id = t.id) AS following,
                EXISTS (SELECT 1 FROM user_follows WHERE follower_id = t.id AND followee_id = $1) AS followed_by
         FROM unnest($2::uuid[]) AS t(id)`,
        [viewerId, ids],
      ),
    );
    return Object.fromEntries(
      rows.map((row) => [row.id, { following: row.following, followedBy: row.followed_by }]),
    );
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return this.follows.exists({ where: { followerId, followeeId } });
  }

  /** Dùng khi một bên chặn bên kia: xóa quan hệ hai chiều và trừ bộ đếm trong cùng giao dịch. */
  async removeBetween(a: string, b: string, outer?: EntityManager): Promise<void> {
    const run = async (manager: EntityManager): Promise<void> => {
      const removed = rowsOf<{ follower_id: string; followee_id: string }>(
        await manager.query(
          `DELETE FROM user_follows
           WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)
           RETURNING follower_id, followee_id`,
          [a, b],
        ),
      );
      if (!removed.length) return;
      await this.bump(
        manager,
        removed.flatMap((row) => [
          { userId: row.follower_id, followers: 0, following: -1 },
          { userId: row.followee_id, followers: -1, following: 0 },
        ]),
      );
    };
    if (outer) await run(outer);
    else await this.dataSource.transaction(run);
  }

  /** Đếm lại từ bảng cạnh (đối soát khi nghi ngờ lệch, hoặc sau khi nạp dữ liệu mẫu). */
  async reconcile(): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO user_follow_stats (user_id, follower_count, following_count, updated_at)
      SELECT u.id,
             (SELECT count(*) FROM user_follows WHERE followee_id = u.id),
             (SELECT count(*) FROM user_follows WHERE follower_id = u.id),
             now()
      FROM users u
      ON CONFLICT (user_id) DO UPDATE
        SET follower_count = EXCLUDED.follower_count,
            following_count = EXCLUDED.following_count,
            updated_at = now()`);
  }

  // --- Nội bộ --------------------------------------------------------------

  private async stateOf(viewerId: string, targetId: string): Promise<FollowState> {
    const [relations, counts] = await Promise.all([
      viewerId === targetId
        ? Promise.resolve({ following: false, followedBy: false })
        : this.relationships(viewerId, targetId).then((map) => map[targetId] ?? { following: false, followedBy: false }),
      this.counts(targetId),
    ]);
    return { ...relations, ...counts, self: viewerId === targetId };
  }

  private async counts(userId: string): Promise<{ followerCount: number; followingCount: number }> {
    const row = rowsOf<{ follower_count: number; following_count: number }>(
      await this.dataSource.query(
        `SELECT follower_count, following_count FROM user_follow_stats WHERE user_id = $1`,
        [userId],
      ),
    )[0];
    return { followerCount: row?.follower_count ?? 0, followingCount: row?.following_count ?? 0 };
  }

  /** Cộng dồn theo người dùng rồi cập nhật theo thứ tự id tăng dần để các giao dịch không khóa chéo nhau. */
  private async bump(manager: EntityManager, deltas: Delta[]): Promise<void> {
    const merged = new Map<string, Delta>();
    for (const delta of deltas) {
      const current = merged.get(delta.userId) ?? { userId: delta.userId, followers: 0, following: 0 };
      current.followers += delta.followers;
      current.following += delta.following;
      merged.set(delta.userId, current);
    }
    for (const delta of [...merged.values()].sort((x, y) => (x.userId < y.userId ? -1 : 1))) {
      await manager.query(
        `INSERT INTO user_follow_stats (user_id, follower_count, following_count, updated_at)
         VALUES ($1, GREATEST($2::int, 0), GREATEST($3::int, 0), now())
         ON CONFLICT (user_id) DO UPDATE SET
           follower_count = GREATEST(user_follow_stats.follower_count + $2::int, 0),
           following_count = GREATEST(user_follow_stats.following_count + $3::int, 0),
           updated_at = now()`,
        [delta.userId, delta.followers, delta.following],
      );
    }
  }

  private async requireTarget(targetId: string): Promise<void> {
    if (!isUuid(targetId)) notFound('Không tìm thấy người dùng.');
    const target = await this.users.findOne({ where: { id: targetId } });
    if (!target || target.status !== UserStatus.ACTIVE) notFound('Không tìm thấy người dùng.');
  }

  private async blockedBetween(a: string, b: string): Promise<boolean> {
    const rows = rowsOf<unknown>(
      await this.dataSource.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
        [a, b],
      ),
    );
    return rows.length > 0;
  }

  /** Giới hạn khi ghi: Redis lỗi thì từ chối, không mở không giới hạn. */
  private async consume(userId: string): Promise<void> {
    let count: number;
    let ttl: number;
    try {
      const key = `ratelimit:follow:user_${userId}`;
      const client = this.redis.getClient();
      count = await client.incr(key);
      if (count === 1) await client.expire(key, 3600);
      ttl = await client.ttl(key);
    } catch {
      return unavailable();
    }
    if (count > FOLLOW_LIMITS.actionsPerHour) tooMany(Math.max(1, ttl));
  }
}
