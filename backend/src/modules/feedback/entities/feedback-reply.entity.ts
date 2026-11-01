import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';

@Entity('feedback_replies')
@Index('idx_feedback_replies_feedback_created', ['feedbackId', 'createdAt'])
export class FeedbackReplyEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'feedback_id' })
  feedbackId: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @Column({ type: 'varchar', length: 10, name: 'author_role' })
  authorRole: 'user' | 'admin';

  @Column({ type: 'varchar', length: 4000 })
  body: string;
}
