import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';

export type PushPlatform = 'chrome' | 'edge' | 'firefox' | 'safari' | 'other';
export type SuspendReason = 'logout' | 'sessions_revoked' | 'password_changed' | 'inactive' | 'locked';

@Entity('push_subscriptions')
@Index('uk_push_subscriptions_endpoint', ['endpointHash'], { unique: true })
@Index('uk_push_subscriptions_user_device', ['userId', 'deviceId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class PushSubscriptionEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'timestamptz', name: 'suspended_at', nullable: true })
  suspendedAt: Date | null;

  @Column({ type: 'varchar', length: 20, name: 'suspend_reason', nullable: true })
  suspendReason: SuspendReason | null;

  @Column({ type: 'timestamptz', name: 'last_seen_at' })
  lastSeenAt: Date;

  @Column({ type: 'char', length: 64, name: 'endpoint_hash' })
  endpointHash: string;

  @Column({ type: 'bytea', name: 'endpoint_enc' })
  endpointEnc: Buffer;

  @Column({ type: 'bytea', name: 'keys_enc' })
  keysEnc: Buffer;

  @Column({ type: 'smallint', name: 'key_version', default: 1 })
  keyVersion: number;

  @Column({ type: 'char', length: 16, name: 'vapid_key_hash' })
  vapidKeyHash: string;

  @Column({ type: 'varchar', length: 12 })
  platform: PushPlatform;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label: string | null;

  @Column({ type: 'boolean', name: 'installed_pwa', default: false })
  installedPwa: boolean;

  @Column({ type: 'boolean', name: 'push_enabled', default: true })
  pushEnabled: boolean;

  @Column({ type: 'smallint', name: 'failure_count', default: 0 })
  failureCount: number;

  @Column({ type: 'timestamptz', name: 'last_success_at', nullable: true })
  lastSuccessAt: Date | null;

  @Column({ type: 'timestamptz', name: 'last_failure_at', nullable: true })
  lastFailureAt: Date | null;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt: Date | null;
}
