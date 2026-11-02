import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import type { PushUrgency } from '../notification.catalog.js';

export type OutboxStatus = 'queued' | 'sending' | 'sent' | 'skipped' | 'dead';

@Entity('push_outbox')
@Index('ix_push_outbox_due', ['nextAttemptAt'])
export class PushOutboxEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'notification_id' })
  notificationId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10, default: 'queued' })
  status: OutboxStatus;

  @Column({ type: 'varchar', length: 30, name: 'skip_reason', nullable: true })
  skipReason: string | null;

  @Column({ type: 'varchar', length: 8, default: 'normal' })
  urgency: PushUrgency;

  @Column({ type: 'int', name: 'ttl_seconds', default: 86400 })
  ttlSeconds: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  topic: string | null;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', name: 'not_before' })
  notBefore: Date;

  @Column({ type: 'timestamptz', name: 'next_attempt_at' })
  nextAttemptAt: Date;

  @Column({ type: 'varchar', length: 200, name: 'last_error', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt: Date | null;
}
