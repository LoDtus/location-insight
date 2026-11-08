import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { vnDayKey } from './article-frequency.js';
import { articleIssues, type ArticleTopic, searchTextOf } from './article-rules.js';
import { ArticleEntity } from './entities/article.entity.js';
import { SEED_COMMENTS } from './seed-article-recent.js';
import { seedCommentCount, seedDailyViews, seededUnit, seedVotePlan } from './seed-article-engagement.js';
import { SEED_ARTICLES, type SeedArticle } from './seed.config.js';

/** Số ngày lượt đọc mẫu tính lùi từ hôm nay. */
const SEED_VIEW_DAYS = 45;

@Injectable()
export class SeedArticleService implements OnModuleInit, OnApplicationBootstrap {
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
        format: seed.format ?? 'standard',
        videoUrl: null,
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
    const format = seed.format ?? 'standard';
    if (existing.body === seed.body && existing.lede === seed.lede && existing.title === seed.title && existing.format === format) return;
    const draft = { title: seed.title, lede: seed.lede, body: seed.body, topic: seed.topic };
    await this.articles
      .createQueryBuilder()
      .update(ArticleEntity)
      .set({ ...draft, format, searchText: searchTextOf(draft), updatedAt: () => 'created_at' })
      .where('id = :id', { id: existing.id })
      .execute();
    this.logger.log(`Đã cập nhật nội dung bài seed ${seed.slug}`);
  }

  /**
   * Tương tác mẫu cho bài seed (chạy sau khi tài khoản mẫu đã có): lượt đọc theo ngày, bình chọn và bình luận, để các
   * mục Nổi bật / Được quan tâm / Đề xuất có dữ liệu đa dạng. Mỗi phần chỉ chạy khi phần đó của bài còn trống, nên
   * không cộng dồn qua các lần khởi động và không đè tương tác thật.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    try {
      await this.seedEngagement();
    } catch (error) {
      this.logger.warn(`Chưa tạo được tương tác mẫu cho bài viết: ${error instanceof Error ? error.message : 'không rõ'}`);
    }
  }

  private async seedEngagement(): Promise<void> {
    const articles = await this.articles.query<{ id: string; slug: string; topic: ArticleTopic; published_at: Date; views: number; votes: number; comments: number }[]>(
      `SELECT a.id, a.slug, a.topic, a.published_at,
              (SELECT COUNT(*) FROM article_view_daily v WHERE v.article_id = a.id)::int AS views,
              (SELECT COUNT(*) FROM article_votes t WHERE t.article_id = a.id)::int AS votes,
              (SELECT COUNT(*) FROM article_comments c WHERE c.article_id = a.id)::int AS comments
         FROM articles a
        WHERE a.idempotency_key LIKE 'seed:%' AND a.deleted_at IS NULL AND a.published_at IS NOT NULL`,
    );
    const users = await this.articles.query<{ id: string }[]>(
      `SELECT id FROM users WHERE email LIKE '%@email.com' AND role <> 'admin' AND deleted_at IS NULL ORDER BY email`,
    );
    if (articles.length === 0 || users.length === 0) return;

    const today = vnDayKey(new Date());
    const dayKeys: string[] = [];
    for (let back = SEED_VIEW_DAYS - 1; back >= 0; back -= 1) {
      const date = new Date(`${today}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - back);
      dayKeys.push(date.toISOString().slice(0, 10));
    }

    let views = 0;
    let votes = 0;
    let comments = 0;
    for (const article of articles) {
      const publishedAt = new Date(article.published_at);
      if (article.views === 0) {
        const rows = seedDailyViews(article.slug, vnDayKey(publishedAt), dayKeys);
        if (rows.length > 0) {
          await this.articles.query(
            `INSERT INTO article_view_daily (article_id, day, views)
             SELECT $1, d.day::date, d.views FROM unnest($2::text[], $3::int[]) AS d(day, views)
             ON CONFLICT (article_id, day) DO NOTHING`,
            [article.id, rows.map((row) => row.day), rows.map((row) => row.views)],
          );
          views += rows.length;
        }
      }

      const offset = Math.floor(seededUnit(`users:${article.slug}`) * users.length);
      const people = users.map((_, index) => users[(index + offset) % users.length].id);
      const spanMs = Math.max(60_000, Date.now() - publishedAt.getTime());
      const at = (key: string): Date => new Date(publishedAt.getTime() + spanMs * (0.05 + seededUnit(key) * 0.9));

      if (article.votes === 0) {
        const plan = seedVotePlan(article.slug, people.length);
        const voters = people.slice(0, plan.up + plan.down);
        for (const [index, userId] of voters.entries()) {
          await this.articles.query(
            `INSERT INTO article_votes (article_id, user_id, value, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
            [article.id, userId, index < plan.up ? 1 : -1, at(`vote:${article.slug}:${index}`)],
          );
          votes += 1;
        }
      }

      if (article.comments === 0) {
        const pool = SEED_COMMENTS[article.topic];
        const total = seedCommentCount(article.slug, pool.length + 2);
        let firstId: string | null = null;
        let firstAt = publishedAt;
        for (let index = 0; index < total; index += 1) {
          const id = uuidv7();
          // Bình luận thứ 5, 6 là trả lời bình luận đầu (đăng sau nó), để thấy được luồng hai tầng.
          const reply = index >= pool.length && firstId !== null;
          const drawn = at(`comment:${article.slug}:${index}`);
          const createdAt = reply && drawn <= firstAt ? new Date(Math.min(Date.now(), firstAt.getTime() + 3_600_000 * (index + 1))) : drawn;
          const body = reply ? 'Cảm ơn bạn, mình cũng gặp đúng trường hợp này.' : pool[index % pool.length];
          await this.articles.query(
            `INSERT INTO article_comments (id, article_id, user_id, parent_id, body, removed, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, false, $6, $6)`,
            [id, article.id, people[(index + 3) % people.length], reply ? firstId : null, body, createdAt],
          );
          if (index === 0) {
            firstId = id;
            firstAt = createdAt;
          }
          comments += 1;
        }
      }
    }
    if (views + votes + comments > 0) {
      this.logger.log(`Đã tạo tương tác mẫu cho bài viết: ${views} ngày lượt đọc, ${votes} bình chọn, ${comments} bình luận.`);
    }
  }
}
