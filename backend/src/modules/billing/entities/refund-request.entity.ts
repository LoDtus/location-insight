import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';
import { PaymentOrderEntity } from './payment-order.entity.js';

export type RefundReason =
  | 'within_24h'
  | 'service_outage'
  | 'operator_stop'
  | 'duplicate_or_wrong'
  | 'overpay'
  | 'legal';

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'paid_out';

@Entity('refund_requests')
@Index('idx_refund_requests_status_created', ['status', 'createdAt'])
@Index('idx_refund_requests_order', ['orderId'])
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

  @Column({ type: 'varchar', length: 32 })
  reason: RefundReason;

  @Column({ type: 'int', name: 'amount_vnd' })
  amountVnd: number;

  @Column({ type: 'varchar', length: 20, default: 'requested' })
  status: RefundStatus;

  @Column({ type: 'varchar', length: 500, name: 'user_note', nullable: true })
  userNote: string | null;

  @Column({ type: 'varchar', length: 120, name: 'payout_account_name' })
  payoutAccountName: string;

  @Column({ type: 'varchar', length: 32, name: 'payout_account_number' })
  payoutAccountNumber: string;

  @Column({ type: 'varchar', length: 64, name: 'payout_bank' })
  payoutBank: string;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'decision_note',
    nullable: true,
  })
  decisionNote: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'payout_reference',
    nullable: true,
  })
  payoutReference: string | null;

  @Column({ type: 'uuid', name: 'decided_by', nullable: true })
  decidedBy: string | null;

  @Column({ type: 'timestamptz', name: 'decided_at', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'paid_out_at', nullable: true })
  paidOutAt: Date | null;
}
