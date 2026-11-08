import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { vnDayKey } from './article-frequency.js';
import { engagementScore, isBotAgent, recommendScore, topicAffinity, type RankInput } from './article-discovery.js';
import { ARTICLE_TOPICS, type ArticleFormat, videoEmbedUrl } from './article-rules.js';
import { ArticleEntity } from './entities/article.entity.js';

/** Thẻ bài trên trang /bai-viet: thông tin công khai kèm số liệu để hiển thị (lượt đọc, bình luận). */
export type ArticleCard = {
  slug: string;
  title: string;
  lede: string;
  topic: string;
  publishedAt: Date;
  coverImage: string | null;
  format: ArticleFormat;
  videoEmbed: string | null;
  views: number;
  comments: number;
  upvotes: number;
};

export type ArticleHome = {
  /** Bài dẫn đầu trang (mới nhất có ảnh bìa). */
  lead: ArticleCard | null;
  /** Bài phụ cạnh bài dẫn. */
  secondary: ArticleCard[];
  latest: ArticleCard[];
  /** Đọc nhiều nhất; `popularWindow` cho biết cửa sổ đã dùng. */
  popular: ArticleCard[];
  popularWindow: '7d' | '30d' | 'all';
  engaged: ArticleCard[];
  recommended: ArticleCard[];
  media: ArticleCard[];
  topics: { topic: string; items: ArticleCard[] }[];
};

type Row = {
  id: string;
  slug: string;
  title: string;
  lede: string;
  topic: string;
  published_at: Date;
  cover_image: string | null;
  format: ArticleFormat;
  video_url: string | null;
  views_all: number;
  views_7: number;
  views_30: number;
  comments: number;
  comments_30: number;
  up: number;
  down: number;
  votes_30: number;
};

type Pool = { row: Row; card: ArticleCard; rank: RankInput };

const POOL_LIMIT = 500;
const HOME_CACHE_KEY = 'articles:home:v1';
const HOME_CACHE_MS = 60_000;
const VIEW_DEDUPE_MS = 24 * 60 * 60 * 1000;

/**
 * Trang /bai-viet kiểu báo lớn: các mục Mới nhất, Nổi bật (đọc nhiều), Được quan tâm (bình luận/phiếu), Đề xuất,
 * Video / Ảnh và khối theo chủ đề, cùng việc ghi lượt đọc. Kho bài nhỏ (vài trăm) nên nạp một lần các bài công khai
 * gần nhất kèm số liệu rồi xếp hạng trong bộ nhớ; trang chủ được đệm 60 giây trên Redis.
 */
@Injectable()
export class ArticleDiscoveryService {
  constructor(
    @InjectRepository(ArticleEntity) private readonly articles: Repository<ArticleEntity>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Ghi một lượt đọc: mỗi người đọc (IP + trình duyệt, băm, không lưu thô) tính một lần/bài/ngày; bỏ qua bot.
   * Trả `counted` để kiểm thử; lỗi Redis thì bỏ qua lượt đọc chứ không làm hỏng trang.
   */
  async recordView(articleId: string, ip: string, userAgent: string | undefined): Promise<{ counted: boolean }> {
    if (isBotAgent(userAgent)) return { counted: false };
    const day = vnDayKey(new Date());
    const visitor = createHash('sha256').update(`${day}|${ip}|${userAgent ?? ''}`).digest('base64url').slice(0, 22);
    try {
      const fresh = await this.redis.getClient().set(`article:view:${articleId}:${visitor}`, '1', 'PX', VIEW_DEDUPE_MS, 'NX');
      if (fresh !== 'OK') return { counted: false };
    } catch {
      return { counted: false };
    }
    await this.articles.query(
      `INSERT INTO article_view_daily (article_id, day, views) VALUES ($1, $2, 1)
       ON CONFLICT (article_id, day) DO UPDATE SET views = article_view_daily.views + 1`,
      [articleId, day],
    );
    return { counted: true };
  }

  async home(): Promise<ArticleHome> {
    return this.redis.getOrSet(HOME_CACHE_KEY, () => this.buildHome(), HOME_CACHE_MS);
  }

  /**
   * Đề xuất. Khách: xếp theo chất lượng × độ phổ biến × độ mới. Người đã đăng nhập: cộng mức hợp chủ đề từ phiếu và
   * bình luận của họ, bỏ bài họ đã tương tác. Đây là chỗ cắm mô hình đề xuất riêng sau này (cùng đầu ra).
   */
  async recommended(userId: string | null, limit = 8, exclude: readonly string[] = []): Promise<ArticleCard[]> {
    const pool = await this.pool();
    const now = new Date();
    let affinity = new Map<string, number>();
    const seen = new Set<string>(exclude);
    if (userId) {
      const signals = await this.articles.query<{ topic: string; weight: number; slug: string }[]>(
        `SELECT a.topic, a.slug, CASE WHEN v.value = 1 THEN 2 ELSE -1 END AS weight
           FROM article_votes v JOIN articles a ON a.id = v.article_id WHERE v.user_id = $1
         UNION ALL
         SELECT a.topic, a.slug, 3 AS weight
           FROM article_comments c JOIN articles a ON a.id = c.article_id
          WHERE c.user_id = $1 AND c.removed = false AND c.deleted_at IS NULL`,
        [userId],
      );
      affinity = topicAffinity(signals.map((signal) => ({ topic: signal.topic, weight: Number(signal.weight) })));
      for (const signal of signals) seen.add(signal.slug);
    }
    return pool
      .filter((entry) => !seen.has(entry.card.slug))
      .map((entry) => ({ entry, score: recommendScore(entry.rank, now, affinity.get(entry.row.topic) ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => entry.card);
  }

  private async buildHome(): Promise<ArticleHome> {
    const pool = await this.pool();
    const cards = pool.map((entry) => entry.card);
    const lead = pool.find((entry) => entry.card.coverImage)?.card ?? cards[0] ?? null;
    const secondary = cards.filter((card) => card !== lead).slice(0, 3);
    const top = new Set([lead?.slug, ...secondary.map((card) => card.slug)]);

    const byViews = (key: 'views_7' | 'views_30' | 'views_all'): ArticleCard[] =>
      pool
        .filter((entry) => entry.row[key] > 0)
        .sort((a, b) => b.row[key] - a.row[key] || b.card.publishedAt.getTime() - a.card.publishedAt.getTime())
        .slice(0, 5)
        .map((entry) => ({ ...entry.card, views: entry.row[key] }));
    let popularWindow: ArticleHome['popularWindow'] = '7d';
    let popular = byViews('views_7');
    if (popular.length < 3) {
      popularWindow = '30d';
      popular = byViews('views_30');
    }
    if (popular.length < 3) {
      popularWindow = 'all';
      popular = byViews('views_all');
    }
    if (popular.length < 5) {
      // Mới chạy, chưa đủ lượt đọc: bù bằng bài được tương tác nhiều rồi bài mới, để mục không trống.
      const picked = new Set(popular.map((card) => card.slug));
      const fill = [...pool]
        .filter((entry) => !picked.has(entry.card.slug))
        .sort((a, b) => engagementScore(b.rank) - engagementScore(a.rank) || b.card.publishedAt.getTime() - a.card.publishedAt.getTime())
        .slice(0, 5 - popular.length)
        .map((entry) => entry.card);
      popular = [...popular, ...fill];
    }

    const engaged30 = pool.filter((entry) => entry.row.comments_30 + entry.row.votes_30 > 0);
    const engagedPool = engaged30.length >= 3 ? engaged30 : pool.filter((entry) => engagementScore(entry.rank) > 0);
    const engaged = engagedPool
      .sort((a, b) => engagementScore(b.rank) - engagementScore(a.rank))
      .slice(0, 6)
      .map((entry) => entry.card);

    return {
      lead,
      secondary,
      latest: cards.filter((card) => !top.has(card.slug)).slice(0, 10),
      popular,
      popularWindow,
      engaged,
      recommended: await this.recommended(null, 8, [...top].filter((slug): slug is string => Boolean(slug))),
      media: cards.filter((card) => card.format !== 'standard').slice(0, 8),
      topics: ARTICLE_TOPICS.map((topic) => ({ topic, items: cards.filter((card) => card.topic === topic).slice(0, 4) })).filter(
        (block) => block.items.length > 0,
      ),
    };
  }

  /** Bài công khai mới nhất kèm số liệu, một truy vấn. */
  private async pool(): Promise<Pool[]> {
    const now = new Date();
    const today = vnDayKey(now);
    const daysAgo = (days: number): string => {
      const date = new Date(`${today}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - days);
      return date.toISOString().slice(0, 10);
    };
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const rows = await this.articles.query<Row[]>(
      `WITH a AS (
         SELECT id, slug, title, lede, topic, published_at, cover_image, format, video_url
           FROM articles
          WHERE deleted_at IS NULL AND published_at IS NOT NULL AND published_at <= $1
            AND (status = 'published' OR status = 'scheduled')
          ORDER BY published_at DESC
          LIMIT ${POOL_LIMIT}
       )
       SELECT a.*,
              COALESCE(v.views_all, 0)::int AS views_all, COALESCE(v.views_7, 0)::int AS views_7, COALESCE(v.views_30, 0)::int AS views_30,
              COALESCE(c.comments, 0)::int AS comments, COALESCE(c.comments_30, 0)::int AS comments_30,
              COALESCE(t.up, 0)::int AS up, COALESCE(t.down, 0)::int AS down, COALESCE(t.votes_30, 0)::int AS votes_30
         FROM a
         LEFT JOIN (SELECT article_id, SUM(views) AS views_all,
                           SUM(views) FILTER (WHERE day > $2::date) AS views_7,
                           SUM(views) FILTER (WHERE day > $3::date) AS views_30
                      FROM article_view_daily WHERE article_id IN (SELECT id FROM a) GROUP BY article_id) v ON v.article_id = a.id
         LEFT JOIN (SELECT article_id, COUNT(*) AS comments, COUNT(*) FILTER (WHERE created_at >= $4) AS comments_30
                      FROM article_comments WHERE removed = false AND deleted_at IS NULL AND article_id IN (SELECT id FROM a)
                     GROUP BY article_id) c ON c.article_id = a.id
         LEFT JOIN (SELECT article_id, COUNT(*) FILTER (WHERE value = 1) AS up, COUNT(*) FILTER (WHERE value = -1) AS down,
                           COUNT(*) FILTER (WHERE created_at >= $4) AS votes_30
                      FROM article_votes WHERE article_id IN (SELECT id FROM a) GROUP BY article_id) t ON t.article_id = a.id
        ORDER BY a.published_at DESC`,
      [now, daysAgo(7), daysAgo(30), since30],
    );
    return rows.map((row) => {
      const publishedAt = new Date(row.published_at);
      return {
        row,
        card: {
          slug: row.slug,
          title: row.title,
          lede: row.lede,
          topic: row.topic,
          publishedAt,
          coverImage: row.cover_image,
          format: row.format,
          videoEmbed: row.video_url ? videoEmbedUrl(row.video_url) : null,
          views: row.views_all,
          comments: row.comments,
          upvotes: row.up,
        },
        rank: {
          id: row.id,
          topic: row.topic,
          publishedAt,
          views: row.views_30,
          upvotes: row.up,
          downvotes: row.down,
          comments: row.comments,
        },
      };
    });
  }
}
