import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const DISCUSSION_REPORT_REASONS = ['spam', 'harassment', 'scam', 'misinformation', 'inappropriate', 'other'] as const;
export type DiscussionReportReason = (typeof DISCUSSION_REPORT_REASONS)[number];
export const DISCUSSION_REPORT_STATUSES = ['open', 'actioned', 'dismissed'] as const;
export type DiscussionReportStatus = (typeof DISCUSSION_REPORT_STATUSES)[number];

/** Báo cáo một bài trên diễn đàn. Mỗi người báo cáo một bài một lần (báo lại thì cập nhật lý do). */
@Entity('discussion_reports')
@Index('uq_discussion_reports_post_reporter', ['postId', 'reporterId'], { unique: true })
@Index('idx_discussion_reports_status_created', ['status', 'createdAt'])
export class DiscussionReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'post_id' })
  postId: string;

  @Column({ type: 'uuid', name: 'reporter_id' })
  reporterId: string;

  @Column({ type: 'varchar', length: 20 })
  reason: DiscussionReportReason;

  @Column({ type: 'varchar', length: 500, default: '' })
  note: string;

  @Column({ type: 'varchar', length: 12, default: 'open' })
  status: DiscussionReportStatus;

  /** Người kiểm duyệt đã xử lý (null khi còn mở). */
  @Column({ type: 'uuid', name: 'resolved_by', nullable: true })
  resolvedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
