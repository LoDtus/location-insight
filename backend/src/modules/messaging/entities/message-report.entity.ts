import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { bigintTransformer } from './bigint.transformer.js';

export type ReportStatus = 'open' | 'dismissed' | 'actioned';
export type ReportReason = 'spam' | 'scam' | 'harassment' | 'sexual' | 'other';

export interface SnapshotMessage {
  seq: number;
  senderId: string;
  senderName: string;
  kind: string;
  body: string;
  status: string;
  createdAt: string;
  reported: boolean;
  attachmentIds: string[];
}

@Entity('message_reports')
@Index('uk_message_reports_once', ['conversationId', 'messageSeq', 'reporterId'], { unique: true })
@Index('idx_message_reports_status_created', ['status', 'createdAt'])
@Index('idx_message_reports_reported_user', ['reportedUserId', 'createdAt'])
export class MessageReportEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @Column({ type: 'bigint', name: 'message_seq', transformer: bigintTransformer })
  messageSeq: number;

  @Column({ type: 'uuid', name: 'reporter_id' })
  reporterId: string;

  @Column({ type: 'uuid', name: 'reported_user_id' })
  reportedUserId: string;

  @Column({ type: 'varchar', length: 20, name: 'reason_code' })
  reasonCode: ReportReason;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', name: 'context_snapshot' })
  contextSnapshot: SnapshotMessage[];

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: ReportStatus;

  @Column({ type: 'uuid', name: 'resolved_by', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;
}
