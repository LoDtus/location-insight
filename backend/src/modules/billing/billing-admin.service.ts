import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { Principal } from '../rbac/authorization.types.js';
import { PolicyService } from '../rbac/policy.service.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { CreditLedgerEntryEntity } from '../rbac/entities/credit-ledger-entry.entity.js';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from '../rbac/entities/subscription.entity.js';
import { BillingService } from './billing.service.js';
import { BillingNoticeEntity } from './entities/billing-notice.entity.js';
import { PaymentOrderEntity } from './entities/payment-order.entity.js';
import { RefundRequestEntity } from './entities/refund-request.entity.js';

@Injectable()
export class BillingAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly billing: BillingService,
    private readonly policy: PolicyService,
    @InjectRepository(PaymentOrderEntity)
    private readonly orders: Repository<PaymentOrderEntity>,
    @InjectRepository(RefundRequestEntity)
    private readonly refunds: Repository<RefundRequestEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptions: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AdminAuditLogEntity)
    private readonly audits: Repository<AdminAuditLogEntity>,
  ) {}

  async listOrders(status: PaymentOrderEntity['status'] | undefined, page = 1) {
    const pageSize = 20;
    const [rows, total] = await this.orders.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return {
      data: rows.map((order) => ({
        ...this.billing.toView(order),
        userId: order.userId,
      })),
      metadata: { page, pageSize, total },
    };
  }

  async listRefunds(page = 1) {
    const pageSize = 20;
    const [rows, total] = await this.refunds.findAndCount({
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        userId: row.userId,
        reason: row.reason,
        amountVnd: row.amountVnd,
        status: row.status,
        payoutAccountName: row.payoutAccountName,
        payoutAccountNumber: row.payoutAccountNumber,
        payoutBank: row.payoutBank,
        payoutReference: row.payoutReference,
        createdAt: row.createdAt,
      })),
      metadata: { page, pageSize, total },
    };
  }

  async resolve(
    actor: Principal,
    orderId: string,
    decision: 'fulfill' | 'reject',
    reason: string,
    ip: string | null,
  ) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.status !== 'needs_review') {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không có đơn đang chờ đối soát.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    if (decision === 'reject') {
      order.status = 'expired';
      await this.orders.save(order);
      await this.audit(actor, 'billing_resolve_reject', order.id, reason, ip);
      return this.billing.toView(order);
    }
    if (order.receivedVnd < order.amountVnd) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Số đã nhận chưa đủ để mở quyền.',
        null,
        HttpStatus.CONFLICT,
      );
    }
    await this.dataSource.transaction((manager) =>
      this.billing.fulfillOrder(
        manager,
        order,
        new Date(),
        order.receivedVnd,
      ),
    );
    await this.billing.invalidate(order.userId);
    await this.audit(actor, 'billing_resolve_fulfill', order.id, reason, ip);
    return this.billing.toView(order);
  }

  async userBilling(actor: Principal, userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy người dùng.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    this.policy.assertCanAffectUser(actor, user);
    return this.billing.myBilling(userId);
  }

  async revoke(
    actor: Principal,
    subscriptionId: string,
    reason: string,
    ip: string | null,
  ) {
    const row = await this.subscriptions.findOne({
      where: { id: subscriptionId },
    });
    if (!row || row.endedAt) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy gói còn hiệu lực.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    const user = await this.users.findOne({ where: { id: row.userId } });
    if (!user) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy người dùng.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    this.policy.assertCanAffectUser(actor, user);
    row.endedAt = new Date();
    row.status = SubscriptionStatus.CANCELED;
    row.reason = reason;
    await this.subscriptions.save(row);
    await this.dataSource.getRepository(BillingNoticeEntity).save(
      this.dataSource.getRepository(BillingNoticeEntity).create({
        userId: row.userId,
        type: 'subscription_revoked',
        subscriptionId: row.id,
        orderId: null,
        title: 'Gói đã được thu hồi',
        body: 'Gói trả phí đã kết thúc. Nếu cần hoàn tiền, hãy gửi yêu cầu.',
        readAt: null,
      }),
    );
    await this.billing.invalidate(row.userId);
    await this.audit(actor, 'billing_revoke', row.id, reason, ip);
    return { id: row.id, endedAt: row.endedAt };
  }

  async decideRefund(
    actor: Principal,
    refundId: string,
    decision: 'approve' | 'reject',
    note: string | undefined,
    ip: string | null,
  ) {
    const refund = await this.refunds.findOne({ where: { id: refundId } });
    if (!refund || refund.status !== 'requested') {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không có yêu cầu hoàn đang chờ.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    refund.decidedBy = actor.userId;
    refund.decidedAt = new Date();
    refund.decisionNote = note ?? null;
    if (decision === 'reject') {
      refund.status = 'rejected';
      await this.refunds.save(refund);
      await this.notifyRefund(refund, 'Yêu cầu hoàn đã bị từ chối.');
      await this.audit(actor, 'billing_refund_reject', refund.id, note || 'Từ chối hoàn', ip);
      return { id: refund.id, status: refund.status };
    }

    const order = await this.orders.findOne({ where: { id: refund.orderId } });
    if (!order) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy đơn của yêu cầu hoàn.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    await this.dataSource.transaction(async (manager) => {
      refund.status = 'approved';
      await manager.save(refund);
      if (refund.amountVnd < order.amountVnd) return;
      if (order.subscriptionId) {
        const subscription = await manager.findOne(SubscriptionEntity, {
          where: { id: order.subscriptionId },
        });
        if (subscription && !subscription.endedAt) {
          subscription.endedAt = new Date();
          subscription.status = SubscriptionStatus.CANCELED;
          await manager.save(subscription);
        }
      }
      if (order.kind === 'valuation_credit') {
        const rows = await manager.find(CreditLedgerEntryEntity, {
          where: { userId: order.userId, kind: 'valuation' },
        });
        const balance = rows.reduce((sum, row) => sum + row.amount, 0);
        if (balance >= 1) {
          await manager.save(
            manager.create(CreditLedgerEntryEntity, {
              userId: order.userId,
              kind: 'valuation',
              amount: -1,
              reason: 'refund',
              idempotencyKey: `refund:${refund.id}`,
              referenceId: refund.id,
              grantedBy: actor.userId,
            }),
          );
        }
      }
    });
    await this.billing.invalidate(order.userId);
    await this.notifyRefund(refund, 'Yêu cầu hoàn đã được chấp thuận. Tiền sẽ được chuyển khoản.');
    await this.audit(actor, 'billing_refund_approve', refund.id, note || 'Duyệt hoàn', ip);
    return { id: refund.id, status: 'approved' as const };
  }

  async markPaidOut(
    actor: Principal,
    refundId: string,
    referenceCode: string,
    ip: string | null,
  ) {
    const refund = await this.refunds.findOne({ where: { id: refundId } });
    if (!refund || refund.status !== 'approved') {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Chỉ ghi đã chi khi yêu cầu đã được duyệt.',
        null,
        HttpStatus.CONFLICT,
      );
    }
    refund.status = 'paid_out';
    refund.paidOutAt = new Date();
    refund.payoutReference = referenceCode;
    await this.refunds.save(refund);
    await this.notifyRefund(refund, `Đã chuyển hoàn. Mã tham chiếu ${referenceCode}.`);
    await this.audit(actor, 'billing_refund_paid', refund.id, referenceCode, ip);
    return { id: refund.id, status: refund.status };
  }

  private async notifyRefund(refund: RefundRequestEntity, body: string) {
    await this.dataSource.getRepository(BillingNoticeEntity).save(
      this.dataSource.getRepository(BillingNoticeEntity).create({
        userId: refund.userId,
        type: 'refund_updated',
        subscriptionId: null,
        orderId: refund.orderId,
        title: 'Cập nhật hoàn tiền',
        body,
        readAt: null,
      }),
    );
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
        targetType: 'billing',
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
