import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';

@Entity('admin_audit_logs')
export class AdminAuditLogEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: UserEntity | null;

  @Index('idx_admin_audit_logs_actor_created')
  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 10, name: 'actor_type', default: 'admin' })
  actorType: 'admin' | 'cli';

  @Index('idx_admin_audit_logs_action_created')
  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Index('idx_admin_audit_logs_target')
  @Column({ type: 'varchar', length: 30, name: 'target_type' })
  targetType: string;

  @Column({ type: 'varchar', length: 64, name: 'target_id' })
  targetId: string;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId: string | null;
}
