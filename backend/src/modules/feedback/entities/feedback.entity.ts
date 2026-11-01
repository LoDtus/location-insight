import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';

export type FeedbackCategory = 'bug' | 'idea' | 'question' | 'other';
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

@Entity('feedbacks')
@Index('idx_feedbacks_status_activity', ['status', 'lastActivityAt'])
@Index('idx_feedbacks_author_activity', ['authorId', 'lastActivityAt'])
export class FeedbackEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @Column({ type: 'varchar', length: 20 })
  category: FeedbackCategory;

  @Column({ type: 'varchar', length: 4000 })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: FeedbackStatus;

  @Column({ type: 'int', name: 'reply_count', default: 0 })
  replyCount: number;

  @Column({ type: 'varchar', length: 10, name: 'last_reply_by', nullable: true })
  lastReplyBy: 'user' | 'admin' | null;

  @Column({ type: 'timestamptz', name: 'last_activity_at', default: () => 'now()' })
  lastActivityAt: Date;

  /** Lần cuối người gửi mở góp ý này; trả lời của admin mới hơn mốc này là "chưa đọc". */
  @Column({ type: 'timestamptz', name: 'user_read_at', default: () => 'now()' })
  userReadAt: Date;
}
