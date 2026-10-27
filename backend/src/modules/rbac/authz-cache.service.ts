import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { REDIS_CHANNELS, REDIS_KEYS } from '../auth/auth.constants.js';
import { Plan, UserRole } from './authorization.types.js';
import { PLAN_RANK } from './authorization.config.js';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from './entities/subscription.entity.js';

export interface AuthzSnapshot {
  role: UserRole.USER | UserRole.ADMIN;
  status: 'active' | 'locked' | 'deleted';
  plan: Plan;
  planUntil: number;
  minIat: number;
}

const AUTHZ_TTL_SECONDS = 15 * 60;

@Injectable()
export class AuthzCacheService {
  private readonly logger = new Logger(AuthzCacheService.name);
  private readonly inflight = new Map<string, Promise<AuthzSnapshot>>();

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptions: Repository<SubscriptionEntity>,
    private readonly redis: RedisService,
  ) {}

  async read(userId: string): Promise<AuthzSnapshot | null> {
    const raw = await this.redis
      .getClient()
      .hmget(
        REDIS_KEYS.authz(userId),
        'role',
        'status',
        'plan',
        'planUntil',
        'minIat',
      );
    if (!raw[0] || !raw[1] || !raw[2]) return null;
    return {
      role: raw[0] as AuthzSnapshot['role'],
      status: raw[1] as AuthzSnapshot['status'],
      plan: raw[2] as Plan,
      planUntil: Number(raw[3] ?? 0),
      minIat: Number(raw[4] ?? 0),
    };
  }

  async load(userId: string): Promise<AuthzSnapshot> {
    const cached = await this.read(userId);
    if (cached) return cached;

    const existing = this.inflight.get(userId);
    if (existing) return existing;

    const pending = this.loadFromDatabase(userId).finally(() => {
      this.inflight.delete(userId);
    });
    this.inflight.set(userId, pending);
    return pending;
  }

  async invalidate(userId: string): Promise<void> {
    const client = this.redis.getClient();
    await client.del(REDIS_KEYS.authz(userId));
    await client.publish(
      REDIS_CHANNELS.authzChanged,
      JSON.stringify({ userId, authzVersion: Date.now() }),
    );
  }

  private async loadFromDatabase(userId: string): Promise<AuthzSnapshot> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error(`Không tìm thấy người dùng ${userId}`);
    }

    const now = new Date();
    const rows = await this.subscriptions.find({
      where: [
        {
          userId,
          status: SubscriptionStatus.ACTIVE,
          periodEnd: MoreThan(now),
          endedAt: IsNull(),
        },
        {
          userId,
          status: SubscriptionStatus.CANCELED,
          periodEnd: MoreThan(now),
          endedAt: IsNull(),
        },
      ],
    });

    let plan = Plan.FREE;
    let planUntil = 0;
    for (const row of rows) {
      const laterSameRank =
      PLAN_RANK[row.plan] === PLAN_RANK[plan] &&
      row.periodEnd.getTime() > planUntil;
    if (PLAN_RANK[row.plan] > PLAN_RANK[plan] || laterSameRank) {
      plan = row.plan;
      planUntil = row.periodEnd.getTime();
    }
    }

    const snapshot: AuthzSnapshot = {
      role: user.role,
      status: user.status,
      plan,
      planUntil,
      minIat: 0,
    };

    try {
      const client = this.redis.getClient();
      const key = REDIS_KEYS.authz(userId);
      await client.hset(key, {
        role: snapshot.role,
        status: snapshot.status,
        plan: snapshot.plan,
        planUntil: String(snapshot.planUntil),
        minIat: '0',
        authzVersion: String(Date.now()),
      });
      await client.expire(key, AUTHZ_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Không ghi được cache quyền: ${String(error)}`);
    }

    return snapshot;
  }
}
