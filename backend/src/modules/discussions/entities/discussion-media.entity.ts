import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';
import { DiscussionPostEntity } from './discussion-post.entity.js';

export type MediaKind = 'image' | 'video';
export type MediaStatus = 'pending' | 'ready' | 'rejected';

@Entity('discussion_media')
export class DiscussionMediaEntity extends AppBaseEntity {
  @ManyToOne(() => DiscussionPostEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'post_id' })
  post: DiscussionPostEntity | null;

  @Index('idx_discussion_media_post')
  @Column({ type: 'uuid', name: 'post_id', nullable: true })
  postId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: UserEntity;

  @Index('idx_discussion_media_author_status')
  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @Index('uk_discussion_media_object_key', { unique: true })
  @Column({ type: 'varchar', length: 240, name: 'object_key' })
  objectKey: string;

  @Column({ type: 'varchar', length: 40, name: 'content_type' })
  contentType: string;

  @Column({ type: 'int', name: 'byte_size' })
  byteSize: number;

  @Column({ type: 'varchar', length: 20 })
  kind: MediaKind;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: MediaStatus;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;
}
