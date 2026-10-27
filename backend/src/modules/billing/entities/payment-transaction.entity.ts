import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { PaymentApplyResult } from '../payment-decision.js';
import { PaymentOrderEntity } from './payment-order.entity.js';

@Entity('payment_transactions')
export class PaymentTransactionEntity extends AppBaseEntity {
  @Index('uk_payment_transactions_sepay_id', { unique: true })
  @Column({ type: 'bigint', name: 'sepay_id' })
  sepayId: string;

  @ManyToOne(() => PaymentOrderEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: PaymentOrderEntity | null;

  @Index('idx_payment_transactions_order')
  @Column({ type: 'uuid', name: 'order_id', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', length: 64 })
  gateway: string;

  @Column({ type: 'varchar', length: 32, name: 'account_number' })
  accountNumber: string;

  @Column({ type: 'varchar', length: 64, name: 'sub_account', nullable: true })
  subAccount: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255 })
  content: string;

  @Column({ type: 'varchar', length: 8, name: 'transfer_type' })
  transferType: 'in' | 'out';

  @Column({ type: 'int', name: 'transfer_amount' })
  transferAmount: number;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'reference_code',
    nullable: true,
  })
  referenceCode: string | null;

  @Column({ type: 'timestamptz', name: 'transaction_at' })
  transactionAt: Date;

  @Column({ type: 'varchar', length: 20, name: 'apply_result' })
  applyResult: PaymentApplyResult | 'duplicate';

  @Column({ type: 'jsonb' })
  raw: Record<string, unknown>;
}
