import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity('auth_events')
export class AuthEventEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;

  @Index('idx_auth_events_user_id_created_at')
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId: string | null;

  @Index('idx_auth_events_type_created_at')
  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;
}
