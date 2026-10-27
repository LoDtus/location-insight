import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { articleIssues, searchTextOf } from './article-rules.js';
import { ArticleEntity } from './entities/article.entity.js';
import { SEED_ARTICLES } from './seed.config.js';

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
      if (existing) continue;

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
}
