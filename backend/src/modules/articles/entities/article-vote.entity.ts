import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** Một phiếu của một người cho một bài: +1 (thích) hoặc -1 (không thích). Bỏ phiếu thì xóa hàng. */
@Entity('article_votes')
@Index('idx_article_votes_article', ['articleId'])
export class ArticleVoteEntity {
  @PrimaryColumn({ type: 'uuid', name: 'article_id' })
  articleId: string;

  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'smallint' })
  value: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
