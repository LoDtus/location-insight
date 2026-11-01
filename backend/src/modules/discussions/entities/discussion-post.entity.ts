import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';
import { DiscussionTopicEntity } from './discussion-topic.entity.js';

export type PostKind = 'question' | 'note' | 'reply';
export type PostStatus = 'visible' | 'hidden' | 'deleted';

@Entity('discussion_posts')
@Index('idx_discussion_posts_visible_roots', ['createdAt'], {
  where: `"root_id" IS NULL AND "status" = 'visible'`,
})
export class DiscussionPostEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: UserEntity;

  @Index('idx_discussion_posts_author_created')
  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @ManyToOne(() => DiscussionTopicEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic: DiscussionTopicEntity;

  @Index('idx_discussion_posts_topic_created')
  @Column({ type: 'uuid', name: 'topic_id' })
  topicId: string;

  @ManyToOne(() => DiscussionPostEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'root_id' })
  root: DiscussionPostEntity | null;

  @Index('idx_discussion_posts_root_created')
  @Column({ type: 'uuid', name: 'root_id', nullable: true })
  rootId: string | null;

  @ManyToOne(() => DiscussionPostEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: DiscussionPostEntity | null;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 20 })
  kind: PostKind;

  @Column({ type: 'varchar', length: 2000 })
  body: string;

  @Column({ type: 'varchar', length: 20, default: 'visible' })
  status: PostStatus;

  @Column({ type: 'int', name: 'reply_count', default: 0 })
  replyCount: number;

  @Column({ type: 'int', name: 'like_count', default: 0 })
  likeCount: number;
}
