import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';
import type { RefundReason, RefundStatus } from '../refund-policy.js';
import { PaymentOrderEntity } from './payment-order.entity.js';

@Entity('refund_requests')
@Index('idx_refund_requests_status_created', ['status', 'createdAt'])
@Index('idx_refund_requests_order', ['orderId'])
@Index('uk_refund_requests_order_reason_open', ['orderId', 'reason'], {
  unique: true,
  where: "status <> 'rejected' AND deleted_at IS NULL",
})
export class RefundRequestEntity extends AppBaseEntity {
  @ManyToOne(() => PaymentOrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: PaymentOrderEntity;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 24 })
  reason: RefundReason;

  @Column({ type: 'int', name: 'amount_vnd' })
  amountVnd: number;

  @Column({ type: 'varchar', length: 16, default: 'requested' })
  status: RefundStatus;

  @Column({ type: 'varchar', length: 500, name: 'user_note', nullable: true })
  userNote: string | null;

  @Column({ type: 'varchar', length: 120, name: 'payout_account_name', nullable: true })
  payoutAccountName: string | null;

  @Column({ type: 'varchar', length: 32, name: 'payout_account_number', nullable: true })
  payoutAccountNumber: string | null;

  @Column({ type: 'varchar', length: 64, name: 'payout_bank', nullable: true })
  payoutBank: string | null;

  @Column({ type: 'varchar', length: 500, name: 'decision_note', nullable: true })
  decisionNote: string | null;

  @Column({ type: 'uuid', name: 'decided_by', nullable: true })
  decidedBy: string | null;

  @Column({ type: 'timestamptz', name: 'decided_at', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'varchar', length: 64, name: 'payout_reference', nullable: true })
  payoutReference: string | null;

  @Column({ type: 'timestamptz', name: 'paid_out_at', nullable: true })
  paidOutAt: Date | null;
}
