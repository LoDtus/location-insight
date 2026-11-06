import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';
import { DiscussionTopicEntity } from './discussion-topic.entity.js';

export type PostKind = 'question' | 'note' | 'reply';
export type PostStatus = 'visible' | 'hidden' | 'deleted' | 'scheduled';
/** Ai xem được bài gốc: chỉ mình tôi, bạn bè (theo dõi lẫn nhau), người theo dõi tôi, mọi người. */
export const POST_VISIBILITIES = ['private', 'friends', 'followers', 'public'] as const;
export type PostVisibility = (typeof POST_VISIBILITIES)[number];

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

  /**
   * Văn bản có markup nhẹ (**đậm**, *nghiêng*, ++gạch chân++, ~~gạch ngang~~, > trích, [chữ](link)); không HTML.
   * Giữ 2000: đổi độ dài bằng synchronize sẽ xóa rồi tạo lại cột (mất dữ liệu); muốn nới phải viết migration ALTER TYPE.
   */
  @Column({ type: 'varchar', length: 2000 })
  body: string;

  @Column({ type: 'varchar', length: 20, default: 'visible' })
  status: PostStatus;

  @Column({ type: 'int', name: 'reply_count', default: 0 })
  replyCount: number;

  @Column({ type: 'int', name: 'like_count', default: 0 })
  likeCount: number;

  @Column({ type: 'int', name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ type: 'varchar', length: 12, default: 'public' })
  visibility: PostVisibility;

  /** Người khác được trả lời (tác giả luôn trả lời được). */
  @Column({ type: 'boolean', name: 'replies_allowed', default: true })
  repliesAllowed: boolean;

  /** Ẩn số lượt thích với người khác (tác giả vẫn thấy). */
  @Column({ type: 'boolean', name: 'hide_like_count', default: false })
  hideLikeCount: boolean;

  /** Ẩn số lượt xem với người khác (tác giả vẫn thấy). */
  @Column({ type: 'boolean', name: 'hide_view_count', default: false })
  hideViewCount: boolean;

  /** Cho người khác chia sẻ / đăng lại / trích dẫn. */
  @Column({ type: 'boolean', name: 'allow_share', default: true })
  allowShare: boolean;

  /** Giờ đăng hẹn trước (status = scheduled cho tới lúc đó). */
  @Index('idx_discussion_posts_publish_at', { where: `"status" = 'scheduled'` })
  @Column({ type: 'timestamptz', name: 'publish_at', nullable: true })
  publishAt: Date | null;
}
