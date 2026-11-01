import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('discussion_likes')
export class DiscussionLikeEntity {
  @PrimaryColumn({ type: 'uuid', name: 'post_id' })
  postId: string;

  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
