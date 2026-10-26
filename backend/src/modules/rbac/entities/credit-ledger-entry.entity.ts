import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';

@Entity('credit_ledger_entries')
@Index('idx_credit_ledger_entries_user_kind', ['userId', 'kind'])
export class CreditLedgerEntryEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20, default: 'valuation' })
  kind: 'valuation';

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 40 })
  reason: 'purchase' | 'use' | 'admin_grant' | 'refund';

  @Index('uk_credit_ledger_entries_idempotency_key', { unique: true })
  @Column({ type: 'varchar', length: 80, name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 64, name: 'reference_id', nullable: true })
  referenceId: string | null;

  @Column({ type: 'uuid', name: 'granted_by', nullable: true })
  grantedBy: string | null;
}
