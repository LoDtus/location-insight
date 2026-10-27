import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';

export type BillingNoticeType =
  | 'renewal_7d'
  | 'renewal_1d'
  | 'renewal_due'
  | 'payment_paid'
  | 'payment_underpaid'
  | 'payment_review'
  | 'refund_updated'
  | 'subscription_revoked';

@Entity('billing_notices')
@Index('idx_billing_notices_user_created', ['userId', 'createdAt'])
@Index('uk_billing_notices_renewal', ['subscriptionId', 'type'], {
  unique: true,
  where: "type in ('renewal_7d', 'renewal_1d', 'renewal_due')",
})
export class BillingNoticeEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  type: BillingNoticeType;

  @Column({ type: 'uuid', name: 'subscription_id', nullable: true })
  subscriptionId: string | null;

  @Column({ type: 'uuid', name: 'order_id', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt: Date | null;
}
