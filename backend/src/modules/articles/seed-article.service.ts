import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { articleIssues, searchTextOf } from './article-rules.js';
import { ArticleEntity } from './entities/article.entity.js';
import { SEED_ARTICLES, type SeedArticle } from './seed.config.js';

@Injectable()
export class SeedArticleService implements OnModuleInit {
  private readonly logger = new Logger(SeedArticleService.name);

  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articles: Repository<ArticleEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;

    for (const seed of SEED_ARTICLES) {
      const existing = await this.articles.findOne({ where: { slug: seed.slug } });
      if (existing) {
        await this.refreshUntouched(existing, seed);
        continue;
      }

      const publishedAt = new Date(seed.publishedAt);
      const draft = {
        title: seed.title,
        slug: seed.slug,
        lede: seed.lede,
        body: seed.body,
        topic: seed.topic,
        status: 'published' as const,
        publishedAt,
        coverImage: seed.coverImage,
        seoTitle: seed.title.slice(0, 70),
        seoDescription: seed.lede.slice(0, 160),
      };
      const issues = articleIssues(draft, publishedAt);
      if (issues.length) {
        this.logger.warn(`Bỏ qua seed ${seed.slug}: ${issues.join(' ')}`);
        continue;
      }

      await this.articles.save(
        this.articles.create({
          ...draft,
          source: 'manual',
          idempotencyKey: `seed:${seed.slug}`,
          reviewNote: null,
          searchText: searchTextOf(draft),
          authorUserId: null,
        }),
      );
      this.logger.log(`Đã tạo bài seed ${seed.slug}`);
    }
  }

  /**
   * Bài seed chưa ai sửa (updated_at = created_at) được cập nhật nội dung theo seed mới; bài admin đã sửa thì giữ nguyên.
   * Giữ updated_at = created_at để lần đổi seed sau vẫn nhận ra bài chưa bị sửa.
   */
  private async refreshUntouched(existing: ArticleEntity, seed: SeedArticle): Promise<void> {
    if (existing.idempotencyKey !== `seed:${seed.slug}`) return;
    if (existing.updatedAt.getTime() !== existing.createdAt.getTime()) return;
    if (existing.body === seed.body && existing.lede === seed.lede && existing.title === seed.title) return;
    const draft = { title: seed.title, lede: seed.lede, body: seed.body, topic: seed.topic };
    await this.articles
      .createQueryBuilder()
      .update(ArticleEntity)
      .set({ ...draft, searchText: searchTextOf(draft), updatedAt: () => 'created_at' })
      .where('id = :id', { id: existing.id })
      .execute();
    this.logger.log(`Đã cập nhật nội dung bài seed ${seed.slug}`);
  }
}
