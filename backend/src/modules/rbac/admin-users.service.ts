import { HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { SessionRevokeReason } from '../auth/entities/auth-session.entity.js';
import { AuthSessionEntity } from '../auth/entities/auth-session.entity.js';
import { UserEntity, UserStatus } from '../auth/entities/user.entity.js';
import { SessionService } from '../auth/session.service.js';
import { Plan, Principal, UserRole } from './authorization.types.js';
import { AuthzCacheService } from './authz-cache.service.js';
import { AdminAuditLogEntity } from './entities/admin-audit-log.entity.js';
import { CreditLedgerEntryEntity } from './entities/credit-ledger-entry.entity.js';
import {
  SubscriptionEntity,
  SubscriptionSource,
  SubscriptionStatus,
} from './entities/subscription.entity.js';
import { PolicyService } from './policy.service.js';
import { QuotaService } from './quota.service.js';

const MAX_GRANT_MS = 400 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptions: Repository<SubscriptionEntity>,
    @InjectRepository(CreditLedgerEntryEntity)
    private readonly credits: Repository<CreditLedgerEntryEntity>,
    @InjectRepository(AdminAuditLogEntity)
    private readonly audits: Repository<AdminAuditLogEntity>,
    private readonly policy: PolicyService,
    private readonly authz: AuthzCacheService,
    private readonly quota: QuotaService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessions: SessionService,
  ) {}

  async search(query: {
    query?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const builder = this.users.createQueryBuilder('user');
    if (query.status)
      builder.andWhere('user.status = :status', { status: query.status });
    if (query.query) {
      builder.andWhere('(user.email ILIKE :q OR user.displayName ILIKE :q)', {
        q: `%${query.query}%`,
      });
    }
    const [rows, total] = await builder
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items: await Promise.all(rows.map((user) => this.summarize(user))),
      total,
    };
  }

  async get(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) this.missing();
    return this.summarize(user);
  }

  async lock(
    actor: Principal,
    userId: string,
    reason: string,
    ip: string | null,
  ) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    const before = user.status;
    user.status = UserStatus.LOCKED;
    await this.users.save(user);
    await this.sessions.revokeAll(user.id, SessionRevokeReason.ACCOUNT_LOCKED);
    await this.authz.invalidate(user.id);
    await this.audit(
      actor,
      'user_lock',
      user.id,
      reason,
      ip,
      { status: before },
      { status: user.status },
    );
  }

  async unlock(
    actor: Principal,
    userId: string,
    reason: string,
    ip: string | null,
  ) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    const before = user.status;
    user.status = UserStatus.ACTIVE;
    await this.users.save(user);
    await this.authz.invalidate(user.id);
    await this.audit(
      actor,
      'user_unlock',
      user.id,
      reason,
      ip,
      { status: before },
      { status: user.status },
    );
  }

  async revokeSessions(
    actor: Principal,
    userId: string,
    reason: string,
    ip: string | null,
  ) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    const revoked = await this.sessions.revokeAll(
      user.id,
      SessionRevokeReason.ADMIN_REVOKED,
    );
    await this.audit(actor, 'session_revoke', user.id, reason, ip, null, {
      revoked,
    });
    return { revoked };
  }

  async grantSubscription(
    actor: Principal,
    userId: string,
    input: { plan: 'unlimited' | 'valued'; periodEnd: string; reason: string },
    ip: string | null,
  ) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    const periodEnd = new Date(input.periodEnd);
    if (
      periodEnd.getTime() <= Date.now() ||
      periodEnd.getTime() - Date.now() > MAX_GRANT_MS
    ) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Thời hạn gói không hợp lệ.',
        null,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const row = await this.subscriptions.save(
      this.subscriptions.create({
        userId: user.id,
        plan: input.plan as SubscriptionEntity['plan'],
        status: SubscriptionStatus.ACTIVE,
        source: SubscriptionSource.ADMIN_GRANT,
        periodStart: new Date(),
        periodEnd,
        endedAt: null,
        paymentOrderId: null,
        grantedBy: actor.userId,
        reason: input.reason,
      }),
    );
    await this.authz.invalidate(user.id);
    await this.audit(
      actor,
      'subscription_grant',
      user.id,
      input.reason,
      ip,
      null,
      {
        subscriptionId: row.id,
        plan: input.plan,
      },
    );
    return { id: row.id };
  }

  async endSubscription(
    actor: Principal,
    userId: string,
    subscriptionId: string,
    reason: string,
    ip: string | null,
  ) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    const row = await this.subscriptions.findOneBy({
      id: subscriptionId,
      userId,
    });
    if (!row) this.missing();
    row.status = SubscriptionStatus.CANCELED;
    row.endedAt = new Date();
    await this.subscriptions.save(row);
    await this.authz.invalidate(user.id);
    await this.audit(
      actor,
      'subscription_grant',
      user.id,
      reason,
      ip,
      { status: 'active' },
      { status: 'canceled' },
    );
  }

  async grantCredit(
    actor: Principal,
    userId: string,
    input: { amount: number; reason: string; idempotencyKey: string },
    ip: string | null,
  ) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    await this.dataSource.transaction(async (manager) => {
      const duplicate = await manager.findOne(CreditLedgerEntryEntity, {
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (duplicate) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Khóa idempotency đã được dùng.',
          null,
          HttpStatus.CONFLICT,
        );
      }
      const current = await this.balance(user.id, manager);
      if (current + input.amount < 0) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Số dư tín dụng không đủ.',
          null,
          HttpStatus.CONFLICT,
        );
      }
      await manager.save(
        manager.create(CreditLedgerEntryEntity, {
          userId: user.id,
          kind: 'valuation',
          amount: input.amount,
          reason: 'admin_grant',
          idempotencyKey: input.idempotencyKey,
          referenceId: null,
          grantedBy: actor.userId,
        }),
      );
    });
    await this.audit(actor, 'credit_grant', user.id, input.reason, ip, null, {
      amount: input.amount,
    });
  }

  async resetQuota(
    actor: Principal,
    userId: string,
    reason: string,
    ip: string | null,
  ) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    await this.quota.reset(user.id);
    await this.audit(actor, 'quota_reset', user.id, reason, ip, null, null);
  }

  async listAudits(query: {
    actorId?: string;
    targetId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const builder = this.audits.createQueryBuilder('log');
    if (query.actorId)
      builder.andWhere('log.actorId = :actorId', { actorId: query.actorId });
    if (query.targetId)
      builder.andWhere('log.targetId = :targetId', {
        targetId: query.targetId,
      });
    if (query.action)
      builder.andWhere('log.action = :action', { action: query.action });
    if (query.from)
      builder.andWhere('log.createdAt >= :from', {
        from: new Date(query.from),
      });
    if (query.to)
      builder.andWhere('log.createdAt <= :to', { to: new Date(query.to) });
    const [rows, total] = await builder
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items: rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorType: row.actorType,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        reason: row.reason,
        createdAt: row.createdAt,
      })),
      total,
    };
  }

  async balance(
    userId: string,
    manager = this.dataSource.manager,
  ): Promise<number> {
    const raw = await manager
      .createQueryBuilder(CreditLedgerEntryEntity, 'entry')
      .select('COALESCE(SUM(entry.amount), 0)', 'sum')
      .where('entry.userId = :userId', { userId })
      .andWhere('entry.kind = :kind', { kind: 'valuation' })
      .getRawOne<{ sum: string }>();
    return Number(raw?.sum ?? 0);
  }

  private async summarize(user: UserEntity) {
    const snapshot = await this.authz.load(user.id);
    const activeSessions = await this.dataSource
      .getRepository(AuthSessionEntity)
      .count({
        where: { userId: user.id, revokedAt: IsNull() },
      });
    const plan = snapshot.planUntil > Date.now() ? snapshot.plan : Plan.FREE;
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      plan: snapshot.role === UserRole.ADMIN ? Plan.VALUED : plan,
      planUntil: snapshot.planUntil ? new Date(snapshot.planUntil) : null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      activeSessions,
    };
  }

  private async requireUser(userId: string): Promise<UserEntity> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) this.missing();
    return user;
  }

  private missing(): never {
    throw new BusinessException(
      ErrorCode.NOT_FOUND,
      'Không tìm thấy người dùng.',
      null,
      HttpStatus.NOT_FOUND,
    );
  }

  private async audit(
    actor: Principal,
    action: string,
    targetId: string,
    reason: string,
    ip: string | null,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ) {
    await this.audits.save(
      this.audits.create({
        actorId: actor.userId,
        actorType: 'admin',
        action,
        targetType: 'user',
        targetId,
        before,
        after,
        reason,
        ipAddress: ip,
        sessionId: actor.sessionId,
      }),
    );
  }
}
