import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { Plan } from '../authorization.types.js';
import { UserEntity } from '../../auth/entities/user.entity.js';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

export enum SubscriptionSource {
  PAYMENT = 'payment',
  ADMIN_GRANT = 'admin_grant',
}

@Entity('subscriptions')
@Index('idx_subscriptions_user_status_period', [
  'userId',
  'status',
  'periodEnd',
])
export class SubscriptionEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  plan: Exclude<Plan, Plan.FREE>;

  @Column({ type: 'varchar', length: 20, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Column({ type: 'varchar', length: 20 })
  source: SubscriptionSource;

  @Column({ type: 'timestamptz', name: 'period_start' })
  periodStart: Date;

  @Column({ type: 'timestamptz', name: 'period_end' })
  periodEnd: Date;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt: Date | null;

  @Index('uk_subscriptions_payment_order_id', { unique: true })
  @Column({
    type: 'varchar',
    length: 64,
    name: 'payment_order_id',
    nullable: true,
  })
  paymentOrderId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'granted_by' })
  grantedByUser: UserEntity | null;

  @Column({ type: 'uuid', name: 'granted_by', nullable: true })
  grantedBy: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;
}
