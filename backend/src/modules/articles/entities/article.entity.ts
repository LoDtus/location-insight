import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import type {
  ArticleFormat,
  ArticleSource,
  ArticleStatus,
  ArticleTopic,
} from '../article-rules.js';

@Entity('articles')
@Index('uk_articles_slug', ['slug'], { unique: true })
@Index('uk_articles_idempotency', ['idempotencyKey'], {
  unique: true,
  where: 'idempotency_key is not null',
})
@Index('idx_articles_status_published', ['status', 'publishedAt'])
export class ArticleEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 140 })
  title: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  lede: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: 'varchar', length: 16 })
  topic: ArticleTopic;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: ArticleStatus;

  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 300, name: 'cover_image', nullable: true })
  coverImage: string | null;

  @Column({ type: 'varchar', length: 70, name: 'seo_title', nullable: true })
  seoTitle: string | null;

  @Column({
    type: 'varchar',
    length: 160,
    name: 'seo_description',
    nullable: true,
  })
  seoDescription: string | null;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source: ArticleSource;

  /** standard | photo | video: quyết định bài nằm ở mục "Video / Ảnh" và cách trình bày đầu bài. */
  @Column({ type: 'varchar', length: 10, default: 'standard' })
  format: ArticleFormat;

  @Column({ type: 'varchar', length: 300, name: 'video_url', nullable: true })
  videoUrl: string | null;

  @Column({
    type: 'varchar',
    length: 80,
    name: 'idempotency_key',
    nullable: true,
  })
  idempotencyKey: string | null;

  @Column({ type: 'varchar', length: 500, name: 'review_note', nullable: true })
  reviewNote: string | null;

  @Column({ type: 'text', name: 'search_text', default: '' })
  searchText: string;

  @Column({ type: 'uuid', name: 'author_user_id', nullable: true })
  authorUserId: string | null;
}
