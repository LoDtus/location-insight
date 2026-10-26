import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { AuthProvider } from './auth-identity.entity.js';
import { UserEntity } from './user.entity.js';

export enum SessionRevokeReason {
  LOGOUT = 'logout',
  LOGOUT_OTHER = 'logout_other',
  LOGOUT_ALL = 'logout_all',
  REUSE_DETECTED = 'reuse_detected',
  PASSWORD_CHANGED = 'password_changed',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_DELETED = 'account_deleted',
  EVICTED = 'evicted',
  EXPIRED = 'expired',
  ADMIN_REVOKED = 'admin_revoked',
}

@Entity('auth_sessions')
export class AuthSessionEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Index('idx_auth_sessions_user_id_revoked_at')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Index('uk_auth_sessions_refresh_hash', { unique: true })
  @Column({ type: 'char', length: 64, name: 'refresh_hash' })
  refreshHash: string;

  @Index('idx_auth_sessions_previous_refresh_hash')
  @Column({
    type: 'char',
    length: 64,
    name: 'previous_refresh_hash',
    nullable: true,
  })
  previousRefreshHash: string | null;

  @Column({ type: 'timestamptz', name: 'rotated_at', nullable: true })
  rotatedAt: Date | null;

  @Column({ type: 'varchar', length: 20, name: 'auth_method' })
  authMethod: AuthProvider;

  @Column({ type: 'timestamptz', name: 'auth_time' })
  authTime: Date;

  @Column({ type: 'varchar', length: 10, name: 'client_type', default: 'web' })
  clientType: 'web' | 'native';

  @Column({ type: 'varchar', length: 80, name: 'device_label' })
  deviceLabel: string;

  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'last_ip_address',
    nullable: true,
  })
  lastIpAddress: string | null;

  @Column({ type: 'char', length: 2, name: 'country_code', nullable: true })
  countryCode: string | null;

  @Column({ type: 'timestamptz', name: 'last_seen_at' })
  lastSeenAt: Date;

  @Index('idx_auth_sessions_idle_expires_at')
  @Column({ type: 'timestamptz', name: 'idle_expires_at' })
  idleExpiresAt: Date;

  @Column({ type: 'timestamptz', name: 'absolute_expires_at' })
  absoluteExpiresAt: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 40,
    name: 'revoked_reason',
    nullable: true,
  })
  revokedReason: SessionRevokeReason | null;
}
