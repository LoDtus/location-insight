import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { Plan } from '../rbac/authorization.types.js';
import { AuthzCacheService } from '../rbac/authz-cache.service.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { CreditLedgerEntryEntity } from '../rbac/entities/credit-ledger-entry.entity.js';
import {
  SubscriptionEntity,
  SubscriptionSource,
  SubscriptionStatus,
} from '../rbac/entities/subscription.entity.js';
import { BILLING_CATALOG, addDays } from './billing.constants.js';
import { BillingNoticeEntity } from './entities/billing-notice.entity.js';
import { PaymentOrderEntity } from './entities/payment-order.entity.js';
import { PaymentTransactionEntity } from './entities/payment-transaction.entity.js';
import { SEED_BILLING } from './seed.config.js';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SeedBillingService implements OnModuleInit {
  private readonly logger = new Logger(SeedBillingService.name);

  constructor(
    private readonly authz: AuthzCacheService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptions: Repository<SubscriptionEntity>,
    @InjectRepository(PaymentOrderEntity)
    private readonly orders: Repository<PaymentOrderEntity>,
    @InjectRepository(PaymentTransactionEntity)
    private readonly transactions: Repository<PaymentTransactionEntity>,
    @InjectRepository(BillingNoticeEntity)
    private readonly notices: Repository<BillingNoticeEntity>,
    @InjectRepository(CreditLedgerEntryEntity)
    private readonly credits: Repository<CreditLedgerEntryEntity>,
    @InjectRepository(AdminAuditLogEntity)
    private readonly audits: Repository<AdminAuditLogEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    const people = await this.users.find({
      where: {
        email: In([
          'admin@location-insight.local',
          'user@location-insight.local',
          'lan-anh@location-insight.local',
          'minh-duc@location-insight.local',
        ]),
      },
    });
    const byEmail = new Map(people.map((user) => [user.email, user]));
    const admin = byEmail.get('admin@location-insight.local');
    const user = byEmail.get('user@location-insight.local');
    const lan = byEmail.get('lan-anh@location-insight.local');
    const minh = byEmail.get('minh-duc@location-insight.local');
    if (!admin || !user || !lan || !minh) {
      this.logger.warn('Bỏ qua seed thanh toán vì thiếu tài khoản mẫu.');
      return;
    }

    await this.subscriptions.query(
      'DROP INDEX IF EXISTS uk_subscriptions_one_open',
    );
    await this.clearAdminPlan(admin);
    await this.paidPlan(user, admin);
    await this.grantedPlan(lan, admin);
    await this.reviewOrder(lan);
    await this.creditOrder(minh);
    await this.directorySamples(admin);
  }

  private async paidPlan(user: UserEntity, admin: UserEntity): Promise<void> {
    if (await this.orders.findOne({ where: { code: SEED_BILLING.paidOrderCode } })) {
      return;
    }
    if (await this.openSubscription(user.id)) {
      this.logger.warn('Bỏ qua gói mẫu vì người dùng đang còn một gói mở.');
      return;
    }
    const paidAt = new Date(Date.now() - 5 * DAY);
    const order = await this.orders.save(
      this.orders.create({
        userId: user.id,
        kind: 'subscription',
        plan: 'unlimited',
        cycle: 'month',
        amountVnd: 30_000,
        receivedVnd: 30_000,
        code: SEED_BILLING.paidOrderCode,
        status: 'paid',
        expiresAt: new Date(paidAt.getTime() + 30 * 60 * 1000),
        paidAt,
        subscriptionId: null,
        creditEntryId: null,
        benefitUsedAt: null,
      }),
    );
    const subscription = await this.subscriptions.save(
      this.subscriptions.create({
        userId: user.id,
        plan: Plan.UNLIMITED,
        status: SubscriptionStatus.ACTIVE,
        source: SubscriptionSource.PAYMENT,
        cycle: 'month',
        periodStart: paidAt,
        periodEnd: addDays(paidAt, BILLING_CATALOG.periodDays.month),
        endedAt: null,
        paymentOrderId: order.id,
        grantedBy: null,
        reason: null,
      }),
    );
    order.subscriptionId = subscription.id;
    await this.orders.save(order);
    await this.transactions.save(
      this.transactions.create({
        sepayId: SEED_BILLING.sepayPaid,
        orderId: order.id,
        gateway: 'seed',
        accountNumber: '0000000000',
        subAccount: null,
        code: order.code,
        content: `${order.code} giao dich mau`,
        transferType: 'in',
        transferAmount: 30_000,
        referenceCode: 'SEED-PAID',
        transactionAt: paidAt,
        applyResult: 'fulfilled',
        raw: { seed: true },
      }),
    );
    await this.notices.save(
      this.notices.create({
        userId: user.id,
        type: 'payment_paid',
        subscriptionId: subscription.id,
        orderId: order.id,
        title: 'Đã ghi nhận thanh toán mẫu',
        body: `Đơn ${order.code} đã mở gói không giới hạn lượt.`,
        readAt: null,
      }),
    );
    await this.audit(admin.id, 'subscription_grant', user.id, 'Gói mẫu từ thanh toán.');
    await this.authz.invalidate(user.id);
    this.logger.log('Đã tạo gói và đơn thanh toán mẫu cho người dùng.');
  }

  private async grantedPlan(user: UserEntity, admin: UserEntity): Promise<void> {
    const marked = await this.subscriptions.findOne({
      where: { userId: user.id, reason: SEED_BILLING.grantReason },
    });
    if (marked || (await this.openSubscription(user.id))) return;
    const start = new Date();
    await this.subscriptions.save(
      this.subscriptions.create({
        userId: user.id,
        plan: Plan.VALUED,
        status: SubscriptionStatus.ACTIVE,
        source: SubscriptionSource.ADMIN_GRANT,
        cycle: 'month',
        periodStart: start,
        periodEnd: addDays(start, BILLING_CATALOG.periodDays.month),
        endedAt: null,
        paymentOrderId: null,
        grantedBy: admin.id,
        reason: SEED_BILLING.grantReason,
      }),
    );
    await this.audit(admin.id, 'subscription_grant', user.id, SEED_BILLING.grantReason);
    await this.authz.invalidate(user.id);
    this.logger.log('Đã cấp gói mẫu cho Lan Anh.');
  }

  private async reviewOrder(user: UserEntity): Promise<void> {
    if (await this.orders.findOne({ where: { code: SEED_BILLING.reviewOrderCode } })) {
      return;
    }
    const now = new Date();
    const order = await this.orders.save(
      this.orders.create({
        userId: user.id,
        kind: 'subscription',
        plan: 'unlimited',
        cycle: 'month',
        amountVnd: 30_000,
        receivedVnd: 30_000,
        code: SEED_BILLING.reviewOrderCode,
        status: 'needs_review',
        expiresAt: addDays(now, 1),
        paidAt: null,
        subscriptionId: null,
        creditEntryId: null,
        benefitUsedAt: null,
      }),
    );
    await this.transactions.save(
      this.transactions.create({
        sepayId: SEED_BILLING.sepayReview,
        orderId: order.id,
        gateway: 'seed',
        accountNumber: '0000000000',
        subAccount: null,
        code: order.code,
        content: `${order.code} cho doi soat mau`,
        transferType: 'in',
        transferAmount: 30_000,
        referenceCode: 'SEED-REVIEW',
        transactionAt: now,
        applyResult: 'needs_review',
        raw: { seed: true },
      }),
    );
    this.logger.log('Đã tạo đơn chờ đối soát mẫu.');
  }

  private async creditOrder(user: UserEntity): Promise<void> {
    if (
      (await this.orders.findOne({ where: { code: SEED_BILLING.creditOrderCode } })) ||
      (await this.credits.findOne({
        where: { idempotencyKey: SEED_BILLING.creditKey },
      }))
    ) {
      return;
    }
    const paidAt = new Date(Date.now() - DAY);
    const credit = await this.credits.save(
      this.credits.create({
        userId: user.id,
        kind: 'valuation',
        amount: 1,
        reason: 'purchase',
        idempotencyKey: SEED_BILLING.creditKey,
        referenceId: SEED_BILLING.creditOrderCode,
        grantedBy: null,
      }),
    );
    const order = await this.orders.save(
      this.orders.create({
        userId: user.id,
        kind: 'valuation_credit',
        plan: null,
        cycle: 'once',
        amountVnd: BILLING_CATALOG.valuationCreditVnd,
        receivedVnd: BILLING_CATALOG.valuationCreditVnd,
        code: SEED_BILLING.creditOrderCode,
        status: 'paid',
        expiresAt: new Date(paidAt.getTime() + 30 * 60 * 1000),
        paidAt,
        subscriptionId: null,
        creditEntryId: credit.id,
        benefitUsedAt: null,
      }),
    );
    await this.transactions.save(
      this.transactions.create({
        sepayId: SEED_BILLING.sepayCredit,
        orderId: order.id,
        gateway: 'seed',
        accountNumber: '0000000000',
        subAccount: null,
        code: order.code,
        content: `${order.code} tin dung mau`,
        transferType: 'in',
        transferAmount: BILLING_CATALOG.valuationCreditVnd,
        referenceCode: 'SEED-CREDIT',
        transactionAt: paidAt,
        applyResult: 'fulfilled',
        raw: { seed: true },
      }),
    );
    this.logger.log('Đã tạo đơn tín dụng mẫu.');
  }

  private async clearAdminPlan(admin: UserEntity): Promise<void> {
    const open = await this.subscriptions.find({
      where: { userId: admin.id, endedAt: IsNull() },
    });
    const now = new Date();
    for (const row of open) {
      row.status = SubscriptionStatus.CANCELED;
      row.endedAt = now;
      await this.subscriptions.save(row);
    }
    if (open.length > 0) await this.authz.invalidate(admin.id);
  }

  private async directorySamples(admin: UserEntity): Promise<void> {
    await this.stabilizeKnownPlans();
    const samples: DirectorySample[] = [
      {
        email: 'ha-my@location-insight.local',
        plan: Plan.UNLIMITED,
        status: SubscriptionStatus.ACTIVE,
        cycle: 'month',
        start: '2026-10-12T01:00:00.000Z',
        end: '2026-11-11T01:00:00.000Z',
        endedAt: null,
        orderCode: 'DTSEED21',
        amountVnd: 30_000,
        paidAt: '2026-10-12T01:00:00.000Z',
      },
      {
        email: 'quoc-bao@location-insight.local',
        plan: Plan.VALUED,
        status: SubscriptionStatus.ACTIVE,
        cycle: 'year',
        start: '2026-10-01T01:00:00.000Z',
        end: '2027-10-01T01:00:00.000Z',
        endedAt: null,
        orderCode: 'DTSEED22',
        amountVnd: 600_000,
        paidAt: '2026-10-01T01:00:00.000Z',
      },
      {
        email: 'thu-ha@location-insight.local',
        plan: Plan.UNLIMITED,
        status: SubscriptionStatus.TRAILING,
        cycle: 'month',
        start: '2026-10-20T02:00:00.000Z',
        end: '2026-11-20T02:00:00.000Z',
        endedAt: null,
      },
      {
        email: 'duc-anh@location-insight.local',
        plan: Plan.VALUED,
        status: SubscriptionStatus.TRAILING,
        cycle: 'month',
        start: '2026-11-01T02:00:00.000Z',
        end: '2026-11-15T02:00:00.000Z',
        endedAt: null,
      },
      {
        email: 'ngoc-lan@location-insight.local',
        plan: Plan.UNLIMITED,
        status: SubscriptionStatus.CANCELED,
        cycle: 'month',
        start: '2026-10-18T06:00:00.000Z',
        end: '2026-11-18T06:00:00.000Z',
        endedAt: null,
      },
      {
        email: 'thanh-son@location-insight.local',
        plan: Plan.VALUED,
        status: SubscriptionStatus.CANCELED,
        cycle: 'month',
        start: '2026-09-05T07:00:00.000Z',
        end: '2026-10-05T07:00:00.000Z',
        endedAt: '2026-10-01T07:00:00.000Z',
      },
      {
        email: 'my-linh@location-insight.local',
        plan: Plan.UNLIMITED,
        status: SubscriptionStatus.EXPIRED,
        cycle: 'month',
        start: '2026-09-20T04:00:00.000Z',
        end: '2026-10-20T04:00:00.000Z',
        endedAt: null,
      },
      {
        email: 'hoang-nam@location-insight.local',
        plan: Plan.VALUED,
        status: SubscriptionStatus.ACTIVE,
        cycle: 'month',
        start: '2026-09-26T08:00:00.000Z',
        end: '2026-10-26T08:00:00.000Z',
        endedAt: null,
        orderCode: 'DTSEED23',
        amountVnd: 60_000,
        paidAt: '2026-09-26T08:00:00.000Z',
      },
      {
        email: 'phuong-anh@location-insight.local',
        plan: Plan.UNLIMITED,
        status: SubscriptionStatus.ACTIVE,
        cycle: 'month',
        start: '2026-11-01T05:00:00.000Z',
        end: '2026-12-01T05:00:00.000Z',
        endedAt: null,
        orderCode: 'DTSEED24',
        amountVnd: 30_000,
        paidAt: '2026-11-01T05:00:00.000Z',
      },
      {
        email: 'khoa-nguyen@location-insight.local',
        plan: Plan.VALUED,
        status: SubscriptionStatus.ACTIVE,
        cycle: 'month',
        start: '2026-11-01T07:00:00.000Z',
        end: '2026-12-01T07:00:00.000Z',
        endedAt: null,
        orderCode: 'DTSEED12',
        amountVnd: 60_000,
        paidAt: '2026-11-01T07:00:00.000Z',
      },
    ];
    for (const sample of samples) {
      await this.ensureSample(admin, sample);
    }
    await this.ensureRevenueOrder({
      email: 'user@location-insight.local',
      code: 'DTSEED11',
      amountVnd: 300_000,
      plan: 'unlimited',
      cycle: 'year',
      paidAt: '2026-10-15T02:00:00.000Z',
    });
  }

  private async stabilizeKnownPlans(): Promise<void> {
    const known = [
      {
        email: 'user@location-insight.local',
        start: '2026-10-27T02:00:00.000Z',
        end: '2026-11-26T02:00:00.000Z',
      },
      {
        email: 'lan-anh@location-insight.local',
        start: '2026-10-08T03:00:00.000Z',
        end: '2026-11-08T03:00:00.000Z',
      },
    ];
    for (const item of known) {
      const user = await this.users.findOne({ where: { email: item.email } });
      if (!user) continue;
      const row = await this.openSubscription(user.id);
      if (!row || row.cycle) continue;
      row.cycle = 'month';
      row.periodStart = new Date(item.start);
      row.periodEnd = new Date(item.end);
      await this.subscriptions.save(row);
    }
  }

  private async ensureSample(
    admin: UserEntity,
    sample: DirectorySample,
  ): Promise<void> {
    const user = await this.users.findOne({ where: { email: sample.email } });
    if (!user) return;
    const reason = `seed:directory:${sample.email}`;
    const existing = await this.subscriptions.findOne({ where: { reason } });
    if (!existing && !(await this.openSubscription(user.id))) {
      await this.subscriptions.save(
        this.subscriptions.create({
          userId: user.id,
          plan: sample.plan,
          status: sample.status,
          source: SubscriptionSource.ADMIN_GRANT,
          cycle: sample.cycle,
          periodStart: new Date(sample.start),
          periodEnd: new Date(sample.end),
          endedAt: sample.endedAt ? new Date(sample.endedAt) : null,
          paymentOrderId: null,
          grantedBy: admin.id,
          reason,
        }),
      );
      await this.authz.invalidate(user.id);
    }
    if (!sample.orderCode || !sample.paidAt || !sample.amountVnd) return;
    await this.ensureRevenueOrder({
      email: sample.email,
      code: sample.orderCode,
      amountVnd: sample.amountVnd,
      plan: sample.plan === Plan.VALUED ? 'valued' : 'unlimited',
      cycle: sample.cycle,
      paidAt: sample.paidAt,
    });
  }

  private async ensureRevenueOrder(input: {
    email: string;
    code: string;
    amountVnd: number;
    plan: 'unlimited' | 'valued';
    cycle: 'month' | 'year';
    paidAt: string;
  }): Promise<void> {
    if (await this.orders.findOne({ where: { code: input.code } })) return;
    const user = await this.users.findOne({ where: { email: input.email } });
    if (!user) return;
    const paidAt = new Date(input.paidAt);
    await this.orders.save(
      this.orders.create({
        userId: user.id,
        kind: 'subscription',
        plan: input.plan,
        cycle: input.cycle,
        amountVnd: input.amountVnd,
        receivedVnd: input.amountVnd,
        code: input.code,
        status: 'paid',
        expiresAt: new Date(paidAt.getTime() + 30 * 60 * 1000),
        paidAt,
        subscriptionId: null,
        creditEntryId: null,
        benefitUsedAt: null,
      }),
    );
  }

  private openSubscription(userId: string): Promise<SubscriptionEntity | null> {
    return this.subscriptions.findOne({
      where: {
        userId,
        endedAt: IsNull(),
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRAILING,
          SubscriptionStatus.CANCELED,
        ]),
      },
    });
  }

  private async audit(
    actorId: string,
    action: string,
    targetId: string,
    reason: string,
  ): Promise<void> {
    await this.audits.save(
      this.audits.create({
        actorId,
        actorType: 'cli',
        action,
        targetType: 'user',
        targetId,
        before: null,
        after: { seed: true },
        reason,
        ipAddress: null,
        sessionId: null,
      }),
    );
  }
}

interface DirectorySample {
  email: string;
  plan: Plan.UNLIMITED | Plan.VALUED;
  status: SubscriptionStatus;
  cycle: 'month' | 'year';
  start: string;
  end: string;
  endedAt: string | null;
  orderCode?: string;
  amountVnd?: number;
  paidAt?: string;
}
