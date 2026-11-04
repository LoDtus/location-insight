import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';

/**
 * Bình luận của bài. Chỉ có hai tầng: bình luận gốc (`parentId` null) và trả lời.
 * Gỡ bình luận gốc còn trả lời thì giữ hàng với `removed = true` để các trả lời không mất ngữ cảnh.
 */
@Entity('article_comments')
@Index('idx_article_comments_article', ['articleId', 'createdAt'])
@Index('idx_article_comments_parent', ['parentId'])
export class ArticleCommentEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'article_id' })
  articleId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 2000, default: '' })
  body: string;

  @Column({ type: 'boolean', default: false })
  removed: boolean;

  @Column({ type: 'timestamptz', name: 'edited_at', nullable: true })
  editedAt: Date | null;
}
