import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** Bài người dùng đã lưu để đọc lại (riêng từng người, đồng bộ mọi thiết bị). */
@Entity('discussion_bookmarks')
@Index('idx_discussion_bookmarks_user_created', ['userId', 'createdAt'])
export class DiscussionBookmarkEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @PrimaryColumn({ type: 'uuid', name: 'post_id' })
  postId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
