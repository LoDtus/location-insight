import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('article_comment_likes')
@Index('idx_article_comment_likes_comment', ['commentId'])
export class ArticleCommentLikeEntity {
  @PrimaryColumn({ type: 'uuid', name: 'comment_id' })
  commentId: string;

  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
