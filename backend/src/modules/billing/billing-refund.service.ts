import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { Principal } from '../rbac/authorization.types.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { CreditLedgerEntryEntity } from '../rbac/entities/credit-ledger-entry.entity.js';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from '../rbac/entities/subscription.entity.js';
import { PolicyService } from '../rbac/policy.service.js';
import { BillingService, isUniqueViolation } from './billing.service.js';
import { CreateRefundDto } from './dto/billing.dto.js';
import { BillingNoticeEntity } from './entities/billing-notice.entity.js';
import { PaymentOrderEntity } from './entities/payment-order.entity.js';
import { RefundRequestEntity } from './entities/refund-request.entity.js';
import {
  REFUND_DENIAL_MESSAGE,
  REFUND_WINDOW_MS,
  evaluateRefund,
  canAdjustRefundAmount,
  isWholeOrderReason,
  maskAccountNumber,
  type RefundStatus,
} from './refund-policy.js';

const OPEN_STATUSES: RefundStatus[] = ['requested', 'approved', 'paid_out'];
const PAGE_SIZE = 20;

export interface RefundView {
  id: string;
  orderId: string;
  orderCode: string | null;
  reason: RefundRequestEntity['reason'];
  amountVnd: number;
  status: RefundStatus;
  userNote: string | null;
  payoutAccountName: string | null;
  payoutAccountNumber: string | null;
  payoutBank: string | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  payoutReference: string | null;
  paidOutAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class BillingRefundService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly billing: BillingService,
    private readonly policy: PolicyService,
    @InjectRepository(RefundRequestEntity)
    private readonly refunds: Repository<RefundRequestEntity>,
  ) {}

  /** Đánh dấu quyền lợi đã dùng cho các đơn vừa trả trong 24 giờ. Gọi khi người dùng chạy một lượt phân tích. */
  async markBenefitUsed(userId: string, now = new Date()): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(PaymentOrderEntity)
      .set({ benefitUsedAt: now })
      .where('user_id = :userId', { userId })
      .andWhere("status = 'paid'")
      .andWhere('benefit_used_at IS NULL')
      .andWhere('paid_at > :since', {
        since: new Date(now.getTime() - REFUND_WINDOW_MS),
      })
      .execute();
  }

  async create(
    userId: string,
    orderId: string,
    input: CreateRefundDto,
  ): Promise<RefundView> {
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const order = await manager.findOne(PaymentOrderEntity, {
          where: { id: orderId, userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) {
          throw new BusinessException(
            ErrorCode.NOT_FOUND,
            'Không tìm thấy đơn.',
            null,
            HttpStatus.NOT_FOUND,
          );
        }
        const open = await manager.find(RefundRequestEntity, {
          where: { orderId, status: In(OPEN_STATUSES) },
        });
        if (open.some((row) => row.reason === input.reason)) {
          throw new BusinessException(
            ErrorCode.CONFLICT,
            'Đã có yêu cầu hoàn cho đơn này với lý do đó.',
            null,
            HttpStatus.CONFLICT,
          );
        }
        const evaluation = evaluateRefund({
          reason: input.reason,
          order,
          alreadyRequestedVnd: open.reduce((sum, row) => sum + row.amountVnd, 0),
          now: new Date(),
        });
        if (!evaluation.ok) {
          throw new BusinessException(
            ErrorCode.VALIDATION_ERROR,
            REFUND_DENIAL_MESSAGE[evaluation.denial],
            { denial: evaluation.denial },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        const refund = await manager.save(
          manager.create(RefundRequestEntity, {
            orderId,
            userId,
            reason: input.reason,
            amountVnd: evaluation.amountVnd,
            status: 'requested',
            userNote: input.userNote?.trim() || null,
            payoutAccountName: input.payoutAccountName,
            payoutAccountNumber: input.payoutAccountNumber,
            payoutBank: input.payoutBank,
            decisionNote: null,
            decidedBy: null,
            decidedAt: null,
            payoutReference: null,
            paidOutAt: null,
          }),
        );
        await this.notify(
          manager,
          userId,
          orderId,
          'Đã nhận yêu cầu hoàn tiền',
          `Yêu cầu hoàn ${evaluation.amountVnd} đồng cho đơn ${order.code} đang chờ xét.`,
        );
        refund.order = order;
        return refund;
      });
      return this.toView(saved, false);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Đã có yêu cầu hoàn cho đơn này với lý do đó.',
          null,
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async listOwn(userId: string): Promise<RefundView[]> {
    const rows = await this.refunds.find({
      where: { userId },
      relations: { order: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map((row) => this.toView(row, false));
  }

  async listAdmin(status: RefundStatus | undefined, page = 1) {
    const [rows, total] = await this.refunds.findAndCount({
      where: status ? { status } : {},
      relations: { order: true },
      order: { createdAt: 'DESC' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    });
    return {
      data: rows.map((row) => ({ ...this.toView(row, true), userId: row.userId })),
      metadata: { page, pageSize: PAGE_SIZE, total },
    };
  }

  async decide(
    actor: Principal,
    id: string,
    decision: 'approve' | 'reject',
    note: string,
    ip: string | null,
    amountVnd?: number,
  ) {
    let userId = '';
    const result = await this.dataSource.transaction(async (manager) => {
      const refund = await this.lockRefund(manager, id);
      if (refund.status !== 'requested') {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Yêu cầu hoàn này đã được xử lý.',
          null,
          HttpStatus.CONFLICT,
        );
      }
      const user = await manager.findOne(UserEntity, {
        where: { id: refund.userId },
      });
      if (!user) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          'Không tìm thấy người dùng.',
          null,
          HttpStatus.NOT_FOUND,
        );
      }
      this.policy.assertCanAffectUser(actor, user);
      userId = user.id;
      const order = await manager.findOne(PaymentOrderEntity, {
        where: { id: refund.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          'Không tìm thấy đơn.',
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      if (amountVnd !== undefined) {
        const adjustable =
          decision === 'approve' &&
          canAdjustRefundAmount(refund.reason) &&
          amountVnd <= refund.amountVnd;
        if (!adjustable) {
          throw new BusinessException(
            ErrorCode.VALIDATION_ERROR,
            'Chỉ được nhập số tiền nhỏ hơn hoặc bằng mức xin hoàn khi duyệt lý do gián đoạn hoặc ngừng dịch vụ.',
            null,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }

      const now = new Date();
      refund.decisionNote = note;
      refund.decidedBy = actor.userId;
      refund.decidedAt = now;
      if (decision === 'reject') {
        refund.status = 'rejected';
        await this.notify(
          manager,
          userId,
          order.id,
          'Yêu cầu hoàn tiền bị từ chối',
          `Yêu cầu hoàn cho đơn ${order.code} không được duyệt. Lý do: ${note}`,
        );
      } else {
        refund.status = 'approved';
        if (amountVnd !== undefined) refund.amountVnd = amountVnd;
        if (isWholeOrderReason(refund.reason)) {
          await this.reclaimBenefit(manager, order, refund.id);
        }
        await this.notify(
          manager,
          userId,
          order.id,
          'Yêu cầu hoàn tiền đã được duyệt',
          `Đơn ${order.code} được duyệt hoàn ${refund.amountVnd} đồng. Khoản tiền sẽ được chuyển vào tài khoản bạn đã khai.`,
        );
      }
      await manager.save(refund);
      await this.audit(manager, actor, `billing_refund_${decision}`, refund.id, note, ip);
      refund.order = order;
      return refund;
    });
    await this.billing.invalidate(userId);
    return this.toView(result, true);
  }

  async markPaidOut(
    actor: Principal,
    id: string,
    referenceCode: string,
    ip: string | null,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const refund = await this.lockRefund(manager, id);
      if (refund.status !== 'approved') {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Chỉ ghi đã chuyển tiền cho yêu cầu đã được duyệt.',
          null,
          HttpStatus.CONFLICT,
        );
      }
      refund.status = 'paid_out';
      refund.payoutReference = referenceCode;
      refund.paidOutAt = new Date();
      await manager.save(refund);
      await this.notify(
        manager,
        refund.userId,
        refund.orderId,
        'Đã chuyển tiền hoàn',
        `Khoản hoàn ${refund.amountVnd} đồng đã được chuyển. Mã tham chiếu: ${referenceCode}.`,
      );
      await this.audit(
        manager,
        actor,
        'billing_refund_paid_out',
        refund.id,
        `Mã tham chiếu ${referenceCode}`,
        ip,
      );
      const order = await manager.findOne(PaymentOrderEntity, {
        where: { id: refund.orderId },
      });
      if (order) refund.order = order;
      return refund;
    });
    return this.toView(result, true);
  }

  private async lockRefund(
    manager: EntityManager,
    id: string,
  ): Promise<RefundRequestEntity> {
    const refund = await manager.findOne(RefundRequestEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!refund) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy yêu cầu hoàn.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    return refund;
  }

  /** Hoàn cả đơn: kết thúc gói của đơn, hoặc trừ đúng một tín dụng nếu sổ còn đủ. */
  private async reclaimBenefit(
    manager: EntityManager,
    order: PaymentOrderEntity,
    refundId: string,
  ): Promise<void> {
    if (order.kind === 'subscription' && order.subscriptionId) {
      const sub = await manager.findOne(SubscriptionEntity, {
        where: { id: order.subscriptionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (sub && !sub.endedAt) {
        sub.endedAt = new Date();
        sub.status = SubscriptionStatus.CANCELED;
        sub.reason = `Hoàn tiền đơn ${order.code}`;
        await manager.save(sub);
      }
      return;
    }
    if (order.kind === 'valuation_credit') {
      const rows = await manager.find(CreditLedgerEntryEntity, {
        where: { userId: order.userId, kind: 'valuation' },
      });
      const balance = rows.reduce((sum, row) => sum + row.amount, 0);
      if (balance < 1) return;
      await manager.save(
        manager.create(CreditLedgerEntryEntity, {
          userId: order.userId,
          kind: 'valuation',
          amount: -1,
          reason: 'refund',
          idempotencyKey: `refund:${refundId}`,
          referenceId: order.id,
          grantedBy: null,
        }),
      );
    }
  }

  private async notify(
    manager: EntityManager,
    userId: string,
    orderId: string,
    title: string,
    body: string,
  ): Promise<void> {
    await manager.save(
      manager.create(BillingNoticeEntity, {
        userId,
        type: 'refund_updated',
        subscriptionId: null,
        orderId,
        title,
        body: body.slice(0, 500),
        readAt: null,
      }),
    );
  }

  private async audit(
    manager: EntityManager,
    actor: Principal,
    action: string,
    targetId: string,
    reason: string,
    ip: string | null,
  ): Promise<void> {
    await manager.save(
      manager.create(AdminAuditLogEntity, {
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

  /** Chủ đơn chỉ thấy 4 số cuối tài khoản. Admin đọc đủ để chuyển khoản. */
  private toView(row: RefundRequestEntity, admin: boolean): RefundView {
    return {
      id: row.id,
      orderId: row.orderId,
      orderCode: row.order?.code ?? null,
      reason: row.reason,
      amountVnd: row.amountVnd,
      status: row.status,
      userNote: row.userNote,
      payoutAccountName: row.payoutAccountName,
      payoutAccountNumber: admin
        ? row.payoutAccountNumber
        : maskAccountNumber(row.payoutAccountNumber),
      payoutBank: row.payoutBank,
      decisionNote: row.decisionNote,
      decidedAt: row.decidedAt,
      payoutReference: row.payoutReference,
      paidOutAt: row.paidOutAt,
      createdAt: row.createdAt,
    };
  }
}
