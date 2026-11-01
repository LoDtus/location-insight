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
import { RefundRequestEntity } from './entities/refund-request.entity.js';
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
    @InjectRepository(RefundRequestEntity)
    private readonly refunds: Repository<RefundRequestEntity>,
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

    await this.paidPlan(user, admin);
    await this.grantedPlan(lan, admin);
    await this.reviewOrder(lan);
    await this.creditRefund(minh);
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

  private async creditRefund(user: UserEntity): Promise<void> {
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
    await this.refunds.save(
      this.refunds.create({
        orderId: order.id,
        userId: user.id,
        reason: 'within_24h',
        amountVnd: BILLING_CATALOG.valuationCreditVnd,
        status: 'requested',
        userNote: 'Yêu cầu hoàn mẫu, chưa dùng lượt định giá.',
        payoutAccountName: 'Minh Đức',
        payoutAccountNumber: '0000000000',
        payoutBank: 'Ngân hàng mẫu',
        decisionNote: null,
        payoutReference: null,
        decidedBy: null,
        decidedAt: null,
        paidOutAt: null,
      }),
    );
    this.logger.log('Đã tạo đơn tín dụng và yêu cầu hoàn mẫu.');
  }

  private openSubscription(userId: string): Promise<SubscriptionEntity | null> {
    return this.subscriptions.findOne({
      where: {
        userId,
        endedAt: IsNull(),
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED]),
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
