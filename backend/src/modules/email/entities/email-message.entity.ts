import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import type { EmailCategory, EmailStatus } from '../email.constants.js';

@Entity('email_messages')
@Index('uk_email_messages_dedupe', ['dedupeKey'], {
  unique: true,
  where: '"dedupe_key" IS NOT NULL',
})
@Index('idx_email_messages_due', ['nextAttemptAt'], {
  where: `"status" IN ('queued','sending')`,
})
@Index('idx_email_messages_user', ['userId', 'createdAt'])
@Index('idx_email_messages_status', ['status', 'createdAt'])
export class EmailMessageEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 60, name: 'template_key' })
  templateKey: string;

  @Column({ type: 'varchar', length: 20 })
  category: EmailCategory;

  @Column({ type: 'varchar', length: 5 })
  locale: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 320, name: 'to_email' })
  toEmail: string;

  @Column({ type: 'varchar', length: 300 })
  subject: string;

  @Column({ type: 'text', name: 'body_html', nullable: true })
  bodyHtml: string | null;

  @Column({ type: 'text', name: 'body_text', nullable: true })
  bodyText: string | null;

  @Column({ type: 'varchar', length: 500, name: 'unsubscribe_url', nullable: true })
  unsubscribeUrl: string | null;

  @Column({ type: 'boolean', default: false })
  sensitive: boolean;

  @Column({ type: 'varchar', length: 12 })
  status: EmailStatus;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', name: 'next_attempt_at' })
  nextAttemptAt: Date;

  @Column({ type: 'varchar', length: 500, name: 'last_error', nullable: true })
  lastError: string | null;

  @Column({ type: 'varchar', length: 200, name: 'provider_message_id', nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'varchar', length: 200, name: 'dedupe_key', nullable: true })
  dedupeKey: string | null;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt: Date | null;
}
