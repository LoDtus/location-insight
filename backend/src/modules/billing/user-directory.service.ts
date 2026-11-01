import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { AuthSessionEntity } from '../auth/entities/auth-session.entity.js';
import { UserEntity, UserStatus } from '../auth/entities/user.entity.js';
import { AuthzCacheService } from '../rbac/authz-cache.service.js';
import { Plan, Principal, UserRole } from '../rbac/authorization.types.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import {
  SubscriptionEntity,
  SubscriptionSource,
  SubscriptionStatus,
} from '../rbac/entities/subscription.entity.js';
import { PolicyService } from '../rbac/policy.service.js';
import { addDays } from './billing.constants.js';
import type { DirectoryQueryDto } from './dto/billing.dto.js';
import { PaymentOrderEntity } from './entities/payment-order.entity.js';

const PAGE_SIZE = 10;
const ONLINE_MS = 5 * 60 * 1000;

type ShownPlan = 'free' | 'unlimited' | 'valued';
type ShownStatus = 'active' | 'trailing' | 'canceled' | 'expired' | 'none';
type ShownCycle = 'month' | 'year' | null;

interface Presented {
  plan: ShownPlan;
  status: ShownStatus;
  cycle: ShownCycle;
  periodEnd: Date | null;
  subscriptionId: string | null;
  open: boolean;
}

@Injectable()
export class UserDirectoryService {
  constructor(
    private readonly policy: PolicyService,
    private readonly authz: AuthzCacheService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptions: Repository<SubscriptionEntity>,
    @InjectRepository(PaymentOrderEntity)
    private readonly orders: Repository<PaymentOrderEntity>,
    @InjectRepository(AdminAuditLogEntity)
    private readonly audits: Repository<AdminAuditLogEntity>,
  ) {}

  async list(query: DirectoryQueryDto) {
    const now = new Date();
    const { monthStart, previousStart, nextStart } = monthBounds(now);
    const people = await this.users.find({
      where: { role: UserRole.USER },
      withDeleted: true,
    });
    const live = people.filter(
      (user) => !user.deletedAt && user.status !== UserStatus.DELETED,
    );
    const subscriptions = await this.subscriptions.find({
      where: { userId: In(live.map((user) => user.id)) },
    });
    const byUser = new Map<string, SubscriptionEntity[]>();
    for (const row of subscriptions) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row);
      byUser.set(row.userId, list);
    }

    const rows = live.map((user) => {
      const latest = pickLatest(byUser.get(user.id) ?? []);
      const view = present(latest, now);
      return {
        userId: user.id,
        planCode: user.planCode ?? '',
        plan: view.plan,
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        joinedAt: user.createdAt.toISOString(),
        periodEnd: view.periodEnd ? view.periodEnd.toISOString() : null,
        status: view.status,
        cycle: view.cycle,
        accountStatus: user.status === UserStatus.LOCKED ? 'locked' : 'active',
        subscriptionId: view.subscriptionId,
        open: view.open,
        sortName: fold(user.displayName),
        sortExpiry: view.periodEnd?.getTime() ?? Number.MAX_SAFE_INTEGER,
        joinedMs: user.createdAt.getTime(),
      };
    });

    const needle = fold(query.q?.trim() ?? '');
    const filtered = rows.filter((row) => {
      if (query.status && row.status !== query.status) return false;
      if (query.plan && row.plan !== query.plan) return false;
      if (!needle) return true;
      return [row.displayName, row.username ?? '', row.email, row.planCode]
        .map(fold)
        .some((value) => value.includes(needle));
    });
    const sort = query.sort ?? 'created_desc';
    filtered.sort((a, b) => {
      if (sort === 'name') return a.sortName.localeCompare(b.sortName, 'vi');
      if (sort === 'expiry') return a.sortExpiry - b.sortExpiry;
      if (sort === 'created_asc') return a.joinedMs - b.joinedMs;
      return b.joinedMs - a.joinedMs;
    });

    const page = query.page && query.page > 0 ? query.page : 1;
    const start = (page - 1) * PAGE_SIZE;
    const items = filtered.slice(start, start + PAGE_SIZE).map((row) => ({
      userId: row.userId,
      planCode: row.planCode,
      plan: row.plan,
      displayName: row.displayName,
      username: row.username,
      email: row.email,
      joinedAt: row.joinedAt,
      periodEnd: row.periodEnd,
      status: row.status,
      cycle: row.cycle,
      accountStatus: row.accountStatus,
      subscriptionId: row.subscriptionId,
      open: row.open,
    }));

    const atStart = people.filter(
      (user) =>
        user.createdAt < monthStart &&
        (!user.deletedAt || user.deletedAt >= monthStart),
    ).length;
    const newCurrent = people.filter(
      (user) => user.createdAt >= monthStart && user.createdAt < nextStart,
    ).length;
    const newPrevious = people.filter(
      (user) =>
        user.createdAt >= previousStart && user.createdAt < monthStart,
    ).length;
    const activeNow = subscriptions.filter(
      (row) =>
        !row.endedAt &&
        row.periodEnd > now &&
        (row.status === SubscriptionStatus.ACTIVE ||
          row.status === SubscriptionStatus.TRAILING),
    ).length;
    const activeThen = subscriptions.filter((row) => covers(row, monthStart)).length;

    return {
      items,
      total: filtered.length,
      page,
      pageSize: PAGE_SIZE,
      summary: {
        users: { total: live.length, delta: live.length - atStart },
        newUsers: { current: newCurrent, previous: newPrevious },
        online: await this.onlineCount(now),
        activePlans: { current: activeNow, delta: activeNow - activeThen },
        revenue: await this.revenue(previousStart, monthStart, nextStart),
        pastDue: subscriptions.filter(
          (row) =>
            !row.endedAt &&
            row.periodEnd < now &&
            (row.status === SubscriptionStatus.ACTIVE ||
              row.status === SubscriptionStatus.TRAILING),
        ).length,
      },
    };
  }

  async renew(actor: Principal, userId: string, ip: string | null) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    const row = pickLatest(
      await this.subscriptions.find({ where: { userId: user.id } }),
    );
    if (!row) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Người này chưa có gói để gia hạn.',
        null,
        HttpStatus.CONFLICT,
      );
    }
    const now = new Date();
    const days = row.cycle === 'year' ? 365 : 30;
    const running =
      !row.endedAt &&
      (row.status === SubscriptionStatus.ACTIVE ||
        row.status === SubscriptionStatus.TRAILING);
    if (running) {
      const base = row.periodEnd > now ? row.periodEnd : now;
      row.periodEnd = addDays(base, days);
    } else {
      row.periodStart = now;
      row.periodEnd = addDays(now, days);
    }
    row.status = SubscriptionStatus.ACTIVE;
    row.endedAt = null;
    if (!row.cycle) row.cycle = 'month';
    await this.subscriptions.save(row);
    await this.authz.invalidate(user.id);
    await this.audit(actor, 'subscription_renew', user.id, 'Gia hạn thủ công.', ip);
    return { id: row.id, periodEnd: row.periodEnd.toISOString() };
  }

  async cancel(actor: Principal, userId: string, ip: string | null) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    const row = await this.subscriptions.findOne({
      where: {
        userId: user.id,
        endedAt: IsNull(),
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRAILING,
          SubscriptionStatus.CANCELED,
        ]),
      },
    });
    if (!row) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Người này không có gói đang mở.',
        null,
        HttpStatus.CONFLICT,
      );
    }
    row.status = SubscriptionStatus.CANCELED;
    row.endedAt = new Date();
    await this.subscriptions.save(row);
    await this.authz.invalidate(user.id);
    await this.audit(
      actor,
      'subscription_cancel',
      user.id,
      'Huỷ gói thủ công, đưa về miễn phí.',
      ip,
    );
    return { id: row.id };
  }

  async changePlan(
    actor: Principal,
    userId: string,
    plan: 'unlimited' | 'valued',
    ip: string | null,
  ) {
    const user = await this.requireUser(userId);
    this.policy.assertCanAffectUser(actor, user);
    const open = await this.subscriptions.findOne({
      where: {
        userId: user.id,
        endedAt: IsNull(),
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRAILING,
          SubscriptionStatus.CANCELED,
        ]),
      },
    });
    if (open) {
      open.plan = plan === 'valued' ? Plan.VALUED : Plan.UNLIMITED;
      await this.subscriptions.save(open);
      await this.authz.invalidate(user.id);
      await this.audit(actor, 'subscription_change', user.id, 'Đổi gói thủ công.', ip);
      return { id: open.id, plan };
    }
    const now = new Date();
    const created = await this.subscriptions.save(
      this.subscriptions.create({
        userId: user.id,
        plan: plan === 'valued' ? Plan.VALUED : Plan.UNLIMITED,
        status: SubscriptionStatus.ACTIVE,
        source: SubscriptionSource.ADMIN_GRANT,
        cycle: 'month',
        periodStart: now,
        periodEnd: addDays(now, 30),
        endedAt: null,
        paymentOrderId: null,
        grantedBy: actor.userId,
        reason: 'Đổi gói thủ công.',
      }),
    );
    await this.authz.invalidate(user.id);
    await this.audit(actor, 'subscription_change', user.id, 'Đổi gói thủ công.', ip);
    return { id: created.id, plan };
  }

  private async requireUser(userId: string): Promise<UserEntity> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.role !== UserRole.USER) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy người dùng.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  private async onlineCount(now: Date): Promise<number> {
    const since = new Date(now.getTime() - ONLINE_MS);
    const raw = await this.users.manager
      .getRepository(AuthSessionEntity)
      .createQueryBuilder('session')
      .select('COUNT(DISTINCT session.userId)', 'count')
      .where('session.revokedAt IS NULL')
      .andWhere('session.lastSeenAt > :since', { since })
      .getRawOne<{ count: string }>();
    return Number(raw?.count ?? 0);
  }

  private async revenue(previousStart: Date, monthStart: Date, nextStart: Date) {
    const currentVnd = await this.sumPaid(monthStart, nextStart);
    const previousVnd = await this.sumPaid(previousStart, monthStart);
    const percent =
      previousVnd === 0
        ? currentVnd === 0
          ? 0
          : null
        : Math.round(((currentVnd - previousVnd) / previousVnd) * 100);
    return { currentVnd, previousVnd, percent };
  }

  private async sumPaid(start: Date, end: Date): Promise<number> {
    const raw = await this.orders
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.amountVnd), 0)', 'total')
      .where('order.status = :status', { status: 'paid' })
      .andWhere('order.paidAt >= :start AND order.paidAt < :end', { start, end })
      .getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  private async audit(
    actor: Principal,
    action: string,
    targetId: string,
    reason: string,
    ip: string | null,
  ) {
    await this.audits.save(
      this.audits.create({
        actorId: actor.userId,
        actorType: 'admin',
        action,
        targetType: 'user',
        targetId,
        before: null,
        after: null,
        reason,
        ipAddress: ip,
        sessionId: actor.sessionId,
      }),
    );
  }
}

function pickLatest(rows: SubscriptionEntity[]): SubscriptionEntity | null {
  if (rows.length === 0) return null;
  const open = rows.filter(
    (row) =>
      !row.endedAt &&
      (row.status === SubscriptionStatus.ACTIVE ||
        row.status === SubscriptionStatus.TRAILING ||
        row.status === SubscriptionStatus.CANCELED),
  );
  const pool = open.length > 0 ? open : rows;
  return [...pool].sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];
}

function present(sub: SubscriptionEntity | null, now: Date): Presented {
  if (!sub) {
    return {
      plan: 'free',
      status: 'none',
      cycle: null,
      periodEnd: null,
      subscriptionId: null,
      open: false,
    };
  }
  const open =
    !sub.endedAt &&
    (sub.status === SubscriptionStatus.ACTIVE ||
      sub.status === SubscriptionStatus.TRAILING ||
      sub.status === SubscriptionStatus.CANCELED);
  if (open && sub.status === SubscriptionStatus.TRAILING) {
    return view(sub, sub.plan, 'trailing', true);
  }
  if (open && sub.status === SubscriptionStatus.ACTIVE) {
    return view(sub, sub.plan, 'active', true);
  }
  if (open && sub.status === SubscriptionStatus.CANCELED && sub.periodEnd > now) {
    return view(sub, sub.plan, 'canceled', true);
  }
  if (sub.status === SubscriptionStatus.CANCELED) {
    return view(sub, 'free', 'canceled', false);
  }
  return view(sub, 'free', 'expired', false);
}

function view(
  sub: SubscriptionEntity,
  plan: ShownPlan,
  status: ShownStatus,
  open: boolean,
): Presented {
  return {
    plan,
    status,
    cycle: open ? sub.cycle : null,
    periodEnd: sub.periodEnd,
    subscriptionId: sub.id,
    open,
  };
}

function covers(row: SubscriptionEntity, moment: Date): boolean {
  return (
    row.periodStart < moment &&
    row.periodEnd > moment &&
    (!row.endedAt || row.endedAt >= moment) &&
    (row.status === SubscriptionStatus.ACTIVE ||
      row.status === SubscriptionStatus.TRAILING)
  );
}

function monthBounds(now: Date): {
  monthStart: Date;
  previousStart: Date;
  nextStart: Date;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return {
    previousStart: new Date(Date.UTC(year, month - 2, 1, -7, 0, 0)),
    monthStart: new Date(Date.UTC(year, month - 1, 1, -7, 0, 0)),
    nextStart: new Date(Date.UTC(year, month, 1, -7, 0, 0)),
  };
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}
