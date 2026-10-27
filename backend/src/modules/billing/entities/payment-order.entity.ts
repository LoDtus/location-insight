import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';

export type PaymentOrderKind = 'subscription' | 'valuation_credit';
export type BillingCycle = 'month' | 'year' | 'once';
export type PaymentOrderStatus =
  | 'pending'
  | 'paid'
  | 'expired'
  | 'canceled'
  | 'needs_review';

@Entity('payment_orders')
@Index('idx_payment_orders_user_created', ['userId', 'createdAt'])
@Index('idx_payment_orders_status_expires', ['status', 'expiresAt'])
export class PaymentOrderEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  kind: PaymentOrderKind;

  @Column({ type: 'varchar', length: 16, nullable: true })
  plan: 'unlimited' | 'valued' | null;

  @Column({ type: 'varchar', length: 16 })
  cycle: BillingCycle;

  @Column({ type: 'int', name: 'amount_vnd' })
  amountVnd: number;

  @Column({ type: 'int', name: 'received_vnd', default: 0 })
  receivedVnd: number;

  @Index('uk_payment_orders_code', { unique: true })
  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: PaymentOrderStatus;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'uuid', name: 'subscription_id', nullable: true })
  subscriptionId: string | null;

  @Column({ type: 'uuid', name: 'credit_entry_id', nullable: true })
  creditEntryId: string | null;

  @Column({ type: 'timestamptz', name: 'benefit_used_at', nullable: true })
  benefitUsedAt: Date | null;
}
