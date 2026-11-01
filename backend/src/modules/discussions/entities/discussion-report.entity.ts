import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';
import { DiscussionPostEntity } from './discussion-post.entity.js';

@Entity('discussion_reports')
@Index('uk_discussion_reports_post_reporter', ['postId', 'reporterId'], {
  unique: true,
})
export class DiscussionReportEntity extends AppBaseEntity {
  @ManyToOne(() => DiscussionPostEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: DiscussionPostEntity;

  @Column({ type: 'uuid', name: 'post_id' })
  postId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: UserEntity;

  @Column({ type: 'uuid', name: 'reporter_id' })
  reporterId: string;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Index('idx_discussion_reports_status_created')
  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: 'open' | 'resolved';
}
