import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import type { NotificationCategory, NotificationTone } from '../notification.catalog.js';

@Entity('notifications')
@Index('ix_notifications_user_list', ['userId', 'id'])
@Index('uk_notifications_user_dedupe', ['userId', 'dedupeKey'], {
  unique: true,
  where: 'dedupe_key IS NOT NULL',
})
export class NotificationEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 60 })
  type: string;

  @Column({ type: 'varchar', length: 20 })
  category: NotificationCategory;

  @Column({ type: 'varchar', length: 40 })
  icon: string;

  @Column({ type: 'varchar', length: 10, default: 'neutral' })
  tone: NotificationTone;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subtitle: string | null;

  @Column({ type: 'varchar', length: 300 })
  link: string;

  @Column({ type: 'jsonb', nullable: true })
  params: Record<string, string> | null;

  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 120, name: 'dedupe_key', nullable: true })
  dedupeKey: string | null;

  @Column({ type: 'varchar', length: 120, name: 'collapse_key', nullable: true })
  collapseKey: string | null;

  @Column({ type: 'int', default: 1 })
  count: number;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt: Date | null;
}
