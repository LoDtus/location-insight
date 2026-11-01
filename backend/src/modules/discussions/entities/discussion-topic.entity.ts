import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';

export type TopicStatus = 'open' | 'locked' | 'hidden';

@Entity('discussion_topics')
export class DiscussionTopicEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: UserEntity;

  @Index('idx_discussion_topics_author')
  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Index('uk_discussion_topics_slug', { unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 280, default: '' })
  summary: string;

  @Index('idx_discussion_topics_status_created')
  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: TopicStatus;
}
