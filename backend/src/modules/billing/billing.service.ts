import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  MoreThan,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { AuthzCacheService } from '../rbac/authz-cache.service.js';
import { Plan } from '../rbac/authorization.types.js';
import { PLAN_RANK } from '../rbac/authorization.config.js';
import {
  DOWNGRADE_MESSAGE,
  decidePlanChange,
  type PaidPlan,
} from '../rbac/subscription-policy.js';
import { CreditLedgerEntryEntity } from '../rbac/entities/credit-ledger-entry.entity.js';
import {
  SubscriptionEntity,
  SubscriptionStatus,
  SubscriptionSource,
} from '../rbac/entities/subscription.entity.js';
import {
  BILLING_CATALOG,
  BILLING_LIMITS,
  addDays,
  billingPrice,
} from './billing.constants.js';
import { BillingConfig } from './billing.config.js';
import { CreateOrderDto } from './dto/billing.dto.js';
import { BillingNoticeEntity } from './entities/billing-notice.entity.js';
import {
  PaymentOrderEntity,
  PaymentOrderStatus,
} from './entities/payment-order.entity.js';
import { PaymentTransactionEntity } from './entities/payment-transaction.entity.js';

export interface OrderView {
  id: string;
  kind: PaymentOrderEntity['kind'];
  plan: PaymentOrderEntity['plan'];
  cycle: PaymentOrderEntity['cycle'];
  amountVnd: number;
  receivedVnd: number;
  code: string;
  status: PaymentOrderStatus;
  expiresAt: Date;
  paidAt: Date | null;
  qrUrl: string;
  bank: string;
  accountNumber: string;
  accountHolder: string;
  transferContent: string;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: BillingConfig,
    private readonly redis: RedisService,
    private readonly authz: AuthzCacheService,
    @InjectRepository(PaymentOrderEntity)
    private readonly orders: Repository<PaymentOrderEntity>,
    @InjectRepository(BillingNoticeEntity)
    private readonly notices: Repository<BillingNoticeEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptions: Repository<SubscriptionEntity>,
    @InjectRepository(CreditLedgerEntryEntity)
    private readonly credits: Repository<CreditLedgerEntryEntity>,
  ) {}

  catalog() {
    return {
      currency: BILLING_CATALOG.currency,
      valuationCreditVnd: BILLING_CATALOG.valuationCreditVnd,
      plans: BILLING_CATALOG.plans.map((plan) => ({
        ...plan,
        periodDays: BILLING_CATALOG.periodDays,
      })),
      paymentReady: this.config.ready,
    };
  }

  async createOrder(userId: string, input: CreateOrderDto): Promise<OrderView> {
    if (!this.config.ready) {
      throw new BusinessException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Chưa cấu hình tài khoản nhận tiền SePay.',
        null,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const amount = billingPrice(input.kind, input.plan, input.cycle);
    if (!amount) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Gói hoặc kỳ thanh toán không hợp lệ.',
        null,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (input.kind === 'subscription' && input.plan) {
      await this.assertPurchaseAllowed(userId, input.plan);
    }
    await this.consumeCheckout(userId);
    const expiresAt = new Date(
      Date.now() + BILLING_CATALOG.orderTtlMinutes * 60 * 1000,
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.nextCode();
      try {
        const saved = await this.orders.save(
          this.orders.create({
            userId,
            kind: input.kind,
            plan: input.kind === 'subscription' ? (input.plan ?? null) : null,
            cycle: input.kind === 'valuation_credit' ? 'once' : input.cycle!,
            amountVnd: amount,
            receivedVnd: 0,
            code,
            status: 'pending',
            expiresAt,
            paidAt: null,
            subscriptionId: null,
            creditEntryId: null,
            benefitUsedAt: null,
          }),
        );
        return this.toView(saved);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new BusinessException(
      ErrorCode.ERROR,
      'Chưa tạo được mã thanh toán. Hãy thử lại.',
      null,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async getOwnOrder(userId: string, id: string): Promise<OrderView> {
    const order = await this.requireOwn(userId, id);
    return this.toView(order);
  }

  async cancelOwnOrder(userId: string, id: string): Promise<OrderView> {
    const order = await this.requireOwn(userId, id);
    if (order.status !== 'pending') {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Chỉ hủy được đơn đang chờ chuyển khoản.',
        null,
        HttpStatus.CONFLICT,
      );
    }
    order.status = 'canceled';
    return this.toView(await this.orders.save(order));
  }

  async myBilling(userId: string) {
    const now = new Date();
    const rows = await this.subscriptions.find({
      where: [
        {
          userId,
          status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRAILING]),
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
    let plan: Plan = Plan.FREE;
    let periodEnd: Date | null = null;
    let cancelAtPeriodEnd = false;
    let subscriptionId: string | null = null;
    let source: SubscriptionSource | null = null;
    for (const row of rows) {
      const laterSameRank =
        PLAN_RANK[row.plan] === PLAN_RANK[plan] &&
        periodEnd !== null &&
        row.periodEnd.getTime() > periodEnd.getTime();
      if (PLAN_RANK[row.plan] > PLAN_RANK[plan] || laterSameRank) {
        plan = row.plan;
        periodEnd = row.periodEnd;
        cancelAtPeriodEnd = row.status === SubscriptionStatus.CANCELED;
        subscriptionId = row.id;
        source = row.source;
      }
    }
    const creditRows = await this.credits.find({
      where: { userId, kind: 'valuation' },
    });
    const valuationCredits = creditRows.reduce(
      (sum, row) => sum + row.amount,
      0,
    );
    const notices = await this.notices.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const orders = await this.orders.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return {
      effectivePlan: plan,
      periodEnd,
      cancelAtPeriodEnd,
      subscriptionId,
      source,
      valuationCredits,
      notices: notices.map((notice) => ({
        id: notice.id,
        type: notice.type,
        title: notice.title,
        body: notice.body,
        readAt: notice.readAt,
        createdAt: notice.createdAt,
      })),
      orders: orders.map((order) => this.toView(order)),
    };
  }

  async cancelSubscription(userId: string, id: string) {
    const row = await this.subscriptions.findOne({ where: { id, userId } });
    if (!row || row.endedAt || row.periodEnd.getTime() <= Date.now()) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy gói còn hạn.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status === SubscriptionStatus.CANCELED) {
      return { id: row.id, status: row.status, periodEnd: row.periodEnd };
    }
    row.status = SubscriptionStatus.CANCELED;
    await this.subscriptions.save(row);
    await this.authz.invalidate(userId);
    return { id: row.id, status: row.status, periodEnd: row.periodEnd };
  }

  async resumeSubscription(userId: string, id: string) {
    const row = await this.subscriptions.findOne({ where: { id, userId } });
    if (
      !row ||
      row.endedAt ||
      row.periodEnd.getTime() <= Date.now() ||
      row.status !== SubscriptionStatus.CANCELED
    ) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Không còn rút lại được lệnh hủy.',
        null,
        HttpStatus.CONFLICT,
      );
    }
    row.status = SubscriptionStatus.ACTIVE;
    await this.subscriptions.save(row);
    await this.authz.invalidate(userId);
    return { id: row.id, status: row.status, periodEnd: row.periodEnd };
  }

  async markNoticeRead(userId: string, id: string): Promise<void> {
    const notice = await this.notices.findOne({ where: { id, userId } });
    if (!notice) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy thông báo.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    if (!notice.readAt) {
      notice.readAt = new Date();
      await this.notices.save(notice);
    }
  }

  async fulfillOrder(
    manager: EntityManager,
    order: PaymentOrderEntity,
    paidAt: Date,
    received: number,
  ): Promise<void> {
    if (order.status === 'paid') return;
    order.receivedVnd = Math.max(order.receivedVnd, received);
    if (
      order.kind === 'subscription' &&
      order.plan &&
      (order.cycle === 'month' || order.cycle === 'year')
    ) {
      const applied = await this.applyPaidPlan(
        manager,
        order,
        order.plan,
        order.cycle,
        paidAt,
      );
      if (!applied) {
        order.status = 'needs_review';
        await manager.save(order);
        await manager
          .createQueryBuilder()
          .update(PaymentTransactionEntity)
          .set({ applyResult: 'needs_review' })
          .where('orderId = :orderId', { orderId: order.id })
          .andWhere('applyResult = :result', { result: 'fulfilled' })
          .execute();
        await manager.save(
          manager.create(BillingNoticeEntity, {
            userId: order.userId,
            type: 'payment_review',
            subscriptionId: null,
            orderId: order.id,
            title: 'Khoản thanh toán cần đối soát',
            body: DOWNGRADE_MESSAGE,
            readAt: null,
          }),
        );
        return;
      }
      order.subscriptionId = applied.id;
    } else {
      const entry = await manager.save(
        manager.create(CreditLedgerEntryEntity, {
          userId: order.userId,
          kind: 'valuation',
          amount: 1,
          reason: 'purchase',
          idempotencyKey: `payment:${order.id}`,
          referenceId: order.id,
          grantedBy: null,
        }),
      );
      order.creditEntryId = entry.id;
    }
    order.status = 'paid';
    order.paidAt = paidAt;
    await manager.save(order);
    await manager.save(
      manager.create(BillingNoticeEntity, {
        userId: order.userId,
        type: 'payment_paid',
        subscriptionId: order.subscriptionId,
        orderId: order.id,
        title: 'Đã ghi nhận thanh toán',
        body: `Đơn ${order.code} đã được ghi nhận ${order.amountVnd} đồng.`,
        readAt: null,
      }),
    );
  }

  async invalidate(userId: string): Promise<void> {
    await this.authz.invalidate(userId);
  }

  toView(order: PaymentOrderEntity): OrderView {
    const params = new URLSearchParams({
      acc: this.config.accountNumber,
      bank: this.config.bankCode,
      amount: String(order.amountVnd),
      des: order.code,
      template: 'compact',
    });
    return {
      id: order.id,
      kind: order.kind,
      plan: order.plan,
      cycle: order.cycle,
      amountVnd: order.amountVnd,
      receivedVnd: order.receivedVnd,
      code: order.code,
      status: order.status,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt,
      qrUrl: this.config.ready
        ? `https://vietqr.app/img?${params.toString()}`
        : '',
      bank: this.config.bankCode,
      accountNumber: this.config.accountNumber,
      accountHolder: this.config.accountHolder,
      transferContent: order.code,
    };
  }

  private async requireOwn(
    userId: string,
    id: string,
  ): Promise<PaymentOrderEntity> {
    const order = await this.orders.findOne({ where: { id, userId } });
    if (!order) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy đơn.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    return order;
  }

  private nextCode(): string {
    return `${this.config.paymentPrefix}${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private async assertPurchaseAllowed(
    userId: string,
    plan: PaidPlan,
  ): Promise<void> {
    const current = await this.currentPaidPlan(userId);
    if (decidePlanChange(current, plan) === 'reject') {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        DOWNGRADE_MESSAGE,
        null,
        HttpStatus.CONFLICT,
      );
    }
  }

  private async currentPaidPlan(userId: string): Promise<PaidPlan | null> {
    const now = new Date();
    const rows = await this.subscriptions.find({
      where: [
        {
          userId,
          status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRAILING]),
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
    let plan: PaidPlan | null = null;
    for (const row of rows) {
      if (!plan || PLAN_RANK[row.plan] > PLAN_RANK[plan]) plan = row.plan;
    }
    return plan;
  }

  private async applyPaidPlan(
    manager: EntityManager,
    order: PaymentOrderEntity,
    plan: PaidPlan,
    cycle: 'month' | 'year',
    paidAt: Date,
  ): Promise<SubscriptionEntity | null> {
    await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
      order.userId,
    ]);
    const open = await manager
      .createQueryBuilder(SubscriptionEntity, 'sub')
      .setLock('pessimistic_write')
      .where('sub.userId = :userId', { userId: order.userId })
      .andWhere('sub.endedAt IS NULL')
      .andWhere('sub.status IN (:...statuses)', {
        statuses: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRAILING,
          SubscriptionStatus.CANCELED,
        ],
      })
      .getMany();
    const entitled = open.filter(
      (row) => row.periodEnd.getTime() > paidAt.getTime(),
    );
    for (const row of open) {
      if (row.periodEnd.getTime() <= paidAt.getTime()) {
        row.status = SubscriptionStatus.EXPIRED;
        await manager.save(row);
      }
    }
    let current: PaidPlan | null = null;
    for (const row of entitled) {
      if (!current || PLAN_RANK[row.plan] > PLAN_RANK[current]) {
        current = row.plan;
      }
    }
    const change = decidePlanChange(current, plan);
    if (change === 'reject') return null;
    const days = BILLING_CATALOG.periodDays[cycle];
    if (change === 'extend') {
      const row = entitled
        .filter((item) => item.plan === plan)
        .sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];
      if (!row) return null;
      for (const other of entitled) {
        if (other.id === row.id) continue;
        other.endedAt = paidAt;
        other.status = SubscriptionStatus.CANCELED;
        await manager.save(other);
      }
      row.periodEnd = addDays(row.periodEnd, days);
      row.status = SubscriptionStatus.ACTIVE;
      row.cycle = cycle;
      if (!row.paymentOrderId) row.paymentOrderId = order.id;
      return manager.save(row);
    }
    for (const row of entitled) {
      row.endedAt = paidAt;
      row.status = SubscriptionStatus.CANCELED;
      await manager.save(row);
    }
    return manager.save(
      manager.create(SubscriptionEntity, {
        userId: order.userId,
        plan: plan as SubscriptionEntity['plan'],
        status: SubscriptionStatus.ACTIVE,
        source: SubscriptionSource.PAYMENT,
        cycle,
        periodStart: paidAt,
        periodEnd: addDays(paidAt, days),
        endedAt: null,
        paymentOrderId: order.id,
        grantedBy: null,
        reason: null,
      }),
    );
  }

  private async consumeCheckout(userId: string): Promise<void> {
    const key = `billing:checkout:${userId}`;
    const client = this.redis.getClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, BILLING_LIMITS.checkoutWindowSeconds);
    }
    if (count > BILLING_LIMITS.checkoutPerHour) {
      throw new BusinessException(
        ErrorCode.TOO_MANY_REQUESTS,
        'Bạn tạo quá nhiều đơn trong một giờ. Hãy đợi rồi thử lại.',
        null,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error as QueryFailedError & { code?: string }).code;
  const driver = (error.driverError as { code?: string } | undefined)?.code;
  return code === '23505' || driver === '23505';
}
