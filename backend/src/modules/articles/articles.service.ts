import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { NotFoundException } from '../../common/exceptions/not-found.exception.js';
import {
  articleIssues,
  isArticleTopic,
  isIdempotencyKey,
  likePattern,
  searchTextOf,
  slugifyTitle,
  type ArticleDraft,
  type ArticleStatus,
} from './article-rules.js';
import {
  ArticleFrequencyQueryDto,
  ArticleListQueryDto,
  ArticlePositionQueryDto,
  ArticleWriteDto,
  IngestArticleDto,
} from './dto/article.dto.js';
import { ArticleEntity } from './entities/article.entity.js';
import {
  ArticleEngagementService,
  type ArticleAuthor,
  type ArticleStats,
} from './article-engagement.service.js';

const PUBLIC_PAGE_SIZE = 6;
const ADMIN_PAGE_SIZES = [10, 20, 50] as const;
const ADMIN_PAGE_SIZE = 10;
const ADMIN_STATUSES = ['draft', 'scheduled', 'published', 'hidden', 'deleted'] as const;
const FREQUENCY_PATTERN = { day: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' } as const;
const FREQUENCY_LIMIT = { day: 366, month: 60, year: 30 } as const;

function adminPageSize(value: number | undefined): number {
  return value !== undefined && (ADMIN_PAGE_SIZES as readonly number[]).includes(value) ? value : ADMIN_PAGE_SIZE;
}

export type ArticlePublicView = {
  slug: string;
  title: string;
  lede: string;
  topic: string;
  publishedAt: Date | null;
  coverImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ArticleDetailView = ArticlePublicView & {
  body: string;
  updatedAt: Date;
  author: ArticleAuthor;
  stats: ArticleStats;
};

export type ArticleAdminView = ArticlePublicView & {
  id: string;
  body: string;
  status: ArticleStatus;
  source: string;
  idempotencyKey: string | null;
  reviewNote: string | null;
  authorUserId: string | null;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type ArticleIngestResult = {
  article: ArticleAdminView;
  held: boolean;
  issues: string[];
};

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articles: Repository<ArticleEntity>,
    private readonly engagement: ArticleEngagementService,
  ) {}

  async listPublic(query: ArticleListQueryDto) {
    const page = query.page ?? 1;
    const qb = this.visibleQuery();
    this.applySearch(qb, query.q);
    if (query.topic && isArticleTopic(query.topic)) {
      qb.andWhere('article.topic = :topic', { topic: query.topic });
    }
    const publicSort = query.sort === 'cu' || query.sort === 'ten' ? query.sort : 'moi';
    this.applySort(qb, publicSort);
    qb.take(PUBLIC_PAGE_SIZE).skip((page - 1) * PUBLIC_PAGE_SIZE);
    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((row) => this.toPublic(row)),
      page,
      pageSize: PUBLIC_PAGE_SIZE,
      total,
    };
  }

  async getPublic(slug: string): Promise<ArticleDetailView> {
    const row = await this.findVisible(slug);
    const [author, stats] = await Promise.all([
      this.engagement.authorOf(row.authorUserId),
      this.engagement.stats(row.id),
    ]);
    return { ...this.toPublic(row), body: row.body, updatedAt: row.updatedAt, author, stats };
  }

  /** Mã bài đang công khai theo slug; bài nháp/ẩn/đã xóa không có đường vào từ API công khai. */
  async findVisible(slug: string): Promise<ArticleEntity> {
    const row = await this.visibleQuery().andWhere('article.slug = :slug', { slug }).getOne();
    if (!row) throw new NotFoundException('Không có bài này.');
    return row;
  }

  /** Bài cùng chủ đề trước, thiếu thì bù bằng bài mới nhất của chủ đề khác. */
  async related(slug: string, limit = 5): Promise<ArticlePublicView[]> {
    const current = await this.findVisible(slug);
    const same = await this.visibleQuery()
      .andWhere('article.id <> :id AND article.topic = :topic', { id: current.id, topic: current.topic })
      .orderBy('article.publishedAt', 'DESC')
      .take(limit)
      .getMany();
    let rows = same;
    if (rows.length < limit) {
      const others = await this.visibleQuery()
        .andWhere('article.id <> :id AND article.topic <> :topic', { id: current.id, topic: current.topic })
        .orderBy('article.publishedAt', 'DESC')
        .take(limit - rows.length)
        .getMany();
      rows = [...rows, ...others];
    }
    return rows.map((row) => this.toPublic(row));
  }

  async getAdminBySlug(slug: string): Promise<ArticleAdminView> {
    const row = await this.articles.findOne({ where: { slug }, withDeleted: true });
    if (!row) throw new NotFoundException('Không có bài này.');
    return this.toAdmin(row);
  }

  /** Công bố ngay. Giữ giờ đăng cũ nếu đã qua, không thì lấy giờ hiện tại. Vẫn phải qua kiểm tra chất lượng. */
  async publish(id: string): Promise<ArticleAdminView> {
    const current = await this.articles.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Không có bài này.');
    const now = new Date();
    const publishedAt = current.publishedAt && current.publishedAt.getTime() <= now.getTime() ? current.publishedAt : now;
    const draft: ArticleDraft = {
      title: current.title,
      slug: current.slug,
      lede: current.lede,
      body: current.body,
      topic: current.topic,
      status: 'published',
      publishedAt,
      coverImage: current.coverImage,
      seoTitle: current.seoTitle,
      seoDescription: current.seoDescription,
    };
    this.assertIssues(draft);
    current.status = 'published';
    current.publishedAt = publishedAt;
    current.reviewNote = null;
    return this.toAdmin(await this.articles.save(current));
  }

  async listAdmin(query: ArticleListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = adminPageSize(query.pageSize);
    const qb = this.articles.createQueryBuilder('article');
    this.applyAdminStatus(qb, query.status);
    this.applySearch(qb, query.q);
    this.applyAdminSort(qb, query.sort);
    qb.take(pageSize).skip((page - 1) * pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const counts = await this.counts();
    return {
      items: rows.map((row) => this.toAdmin(row)),
      page,
      pageSize,
      total,
      counts,
    };
  }

  async adminPosition(query: ArticlePositionQueryDto): Promise<{ found: boolean; page: number; index: number }> {
    const pageSize = adminPageSize(query.pageSize);
    const article = await this.articles.findOne({ where: { id: query.id }, withDeleted: true });
    if (!article) return { found: false, page: 1, index: 0 };
    const visible = this.articles.createQueryBuilder('article').where('article.id = :id', { id: article.id });
    this.applyAdminStatus(visible, query.status);
    this.applySearch(visible, query.q);
    if (!(await visible.getCount())) return { found: false, page: 1, index: 0 };
    const before = this.articles.createQueryBuilder('article');
    this.applyAdminStatus(before, query.status);
    this.applySearch(before, query.q);
    this.applyRowsBefore(before, article, query.sort);
    const count = await before.getCount();
    return {
      found: true,
      page: Math.floor(count / pageSize) + 1,
      index: count % pageSize,
    };
  }

  async getAdmin(id: string): Promise<ArticleAdminView> {
    const row = await this.articles.findOne({ where: { id }, withDeleted: true });
    if (!row) throw new NotFoundException('Không có bài này.');
    return this.toAdmin(row);
  }

  async create(authorUserId: string | null, dto: ArticleWriteDto): Promise<ArticleAdminView> {
    const draft = this.draftFrom(dto);
    this.assertIssues(draft);
    await this.assertUnique(draft.slug, draft.title);
    const saved = await this.articles.save(
      this.articles.create(this.rowFrom(draft, 'manual', null, null, authorUserId)),
    );
    return this.toAdmin(saved);
  }

  async update(
    id: string,
    authorUserId: string | null,
    dto: ArticleWriteDto,
  ): Promise<ArticleAdminView> {
    const current = await this.articles.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Không có bài này.');
    const draft = this.draftFrom(dto);
    this.assertIssues(draft);
    await this.assertUnique(draft.slug, draft.title, id);
    Object.assign(current, this.rowFrom(draft, current.source, current.idempotencyKey, null, authorUserId ?? current.authorUserId));
    const saved = await this.articles.save(current);
    return this.toAdmin(saved);
  }

  async ingest(dto: IngestArticleDto): Promise<ArticleIngestResult> {
    if (!isIdempotencyKey(dto.idempotencyKey)) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Khóa chống trùng không hợp lệ.');
    }
    const existing = await this.articles.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
      withDeleted: true,
    });
    if (existing) {
      return { article: this.toAdmin(existing), held: false, issues: [] };
    }

    const requested = dto.requestedStatus ?? 'draft';
    const slug = (dto.slug?.trim() || slugifyTitle(dto.title)).slice(0, 80);
    const base = this.draftFrom({
      ...dto,
      slug,
      status: requested,
      lede: dto.lede,
      body: dto.body,
    });
    const requestedIssues = articleIssues(base);
    let status: ArticleStatus = requested;
    let issues: string[] = [];
    if (requestedIssues.length && requested !== 'draft') {
      const asDraft = articleIssues({ ...base, status: 'draft' });
      if (asDraft.length) {
        throw new BusinessException(ErrorCode.VALIDATION_ERROR, asDraft.join(' '), asDraft);
      }
      status = 'draft';
      issues = requestedIssues;
    } else if (requestedIssues.length) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        requestedIssues.join(' '),
        requestedIssues,
      );
    }

    try {
      const saved = await this.articles.save(
        this.articles.create(
          this.rowFrom(
            { ...base, status },
            dto.source ?? 'ai',
            dto.idempotencyKey,
            issues.length ? issues.join(' ') : null,
            null,
          ),
        ),
      );
      return { article: this.toAdmin(saved), held: issues.length > 0, issues };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.articles.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
        withDeleted: true,
      });
      if (raced) return { article: this.toAdmin(raced), held: false, issues: [] };
      throw new BusinessException(ErrorCode.CONFLICT, 'Slug hoặc khóa bài đã tồn tại.');
    }
  }

  async hide(id: string): Promise<ArticleAdminView> {
    const current = await this.articles.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Không có bài này.');
    current.status = 'hidden';
    const saved = await this.articles.save(current);
    return this.toAdmin(saved);
  }

  async remove(id: string): Promise<{ id: string }> {
    const current = await this.articles.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Không có bài này.');
    await this.articles.softDelete(id);
    return { id };
  }

  async restore(id: string): Promise<ArticleAdminView> {
    const current = await this.articles.findOne({ where: { id }, withDeleted: true });
    if (!current) throw new NotFoundException('Không có bài này.');
    if (current.deletedAt) await this.articles.restore(id);
    const restored = await this.articles.findOne({ where: { id } });
    if (!restored) throw new NotFoundException('Không có bài này.');
    return this.toAdmin(restored);
  }

  async promoteScheduled(): Promise<void> {
    await this.articles.update(
      { status: 'scheduled', publishedAt: LessThanOrEqual(new Date()) },
      { status: 'published' },
    );
  }

  private visibleQuery() {
    return this.articles
      .createQueryBuilder('article')
      .where(
        `(article.status = 'published' OR (article.status = 'scheduled' AND article.publishedAt <= :now))`,
        { now: new Date() },
      );
  }

  private applyAdminStatus(
    qb: ReturnType<ArticlesService['visibleQuery']>,
    raw: string | undefined,
  ): void {
    const selected = (raw ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => ADMIN_STATUSES.includes(item as (typeof ADMIN_STATUSES)[number]));
    const wantDeleted = selected.includes('deleted');
    const live = selected.filter((item) => item !== 'deleted');
    if (!selected.length) return;
    if (wantDeleted) qb.withDeleted();
    if (wantDeleted && !live.length) {
      qb.andWhere('article.deletedAt IS NOT NULL');
      return;
    }
    if (wantDeleted) {
      qb.andWhere(
        '(article.deletedAt IS NOT NULL OR (article.deletedAt IS NULL AND article.status IN (:...live)))',
        { live },
      );
      return;
    }
    qb.andWhere('article.status IN (:...live)', { live });
  }

  private applyAdminSort(
    qb: ReturnType<ArticlesService['visibleQuery']>,
    sort: ArticleListQueryDto['sort'],
  ): void {
    if (sort === 'updated_asc') {
      qb.orderBy('article.updatedAt', 'ASC').addOrderBy('article.id', 'ASC');
      return;
    }
    if (sort === 'published_desc') {
      qb.orderBy('article.publishedAt', 'DESC', 'NULLS LAST').addOrderBy('article.id', 'DESC');
      return;
    }
    if (sort === 'published_asc') {
      qb.orderBy('article.publishedAt', 'ASC', 'NULLS LAST').addOrderBy('article.id', 'ASC');
      return;
    }
    if (sort === 'title') {
      qb.orderBy('article.title', 'ASC').addOrderBy('article.id', 'ASC');
      return;
    }
    qb.orderBy('article.updatedAt', 'DESC').addOrderBy('article.id', 'DESC');
  }

  private applyRowsBefore(
    qb: ReturnType<ArticlesService['visibleQuery']>,
    article: ArticleEntity,
    sort: ArticleListQueryDto['sort'],
  ): void {
    if (sort === 'updated_asc') {
      this.applyInstantBefore(qb, article.id, 'updated_at', 'ASC');
      return;
    }
    if (sort === 'published_desc') {
      this.applyPublishedBefore(qb, article, 'DESC');
      return;
    }
    if (sort === 'published_asc') {
      this.applyPublishedBefore(qb, article, 'ASC');
      return;
    }
    if (sort === 'title') {
      qb.andWhere('(article.title < :title OR (article.title = :title AND article.id < :id))', {
        title: article.title,
        id: article.id,
      });
      return;
    }
    this.applyInstantBefore(qb, article.id, 'updated_at', 'DESC');
  }

  private applyInstantBefore(
    qb: ReturnType<ArticlesService['visibleQuery']>,
    id: string,
    column: 'updated_at' | 'published_at',
    direction: 'ASC' | 'DESC',
  ): void {
    const op = direction === 'DESC' ? '>' : '<';
    qb.andWhere(
      `(article.${column} ${op} (SELECT ${column} FROM articles WHERE id = :id) OR (article.${column} = (SELECT ${column} FROM articles WHERE id = :id) AND article.id ${op} :id))`,
      { id },
    );
  }

  private applyPublishedBefore(
    qb: ReturnType<ArticlesService['visibleQuery']>,
    article: ArticleEntity,
    direction: 'ASC' | 'DESC',
  ): void {
    if (!article.publishedAt) {
      const op = direction === 'DESC' ? '>' : '<';
      qb.andWhere(
        `(article.published_at IS NOT NULL OR (article.published_at IS NULL AND article.id ${op} :id))`,
        { id: article.id },
      );
      return;
    }
    this.applyInstantBefore(qb, article.id, 'published_at', direction);
  }

  private applySearch(
    qb: ReturnType<ArticlesService['visibleQuery']>,
    query: string | undefined,
  ): void {
    const text = query?.trim();
    if (!text) return;
    qb.andWhere(`article.searchText LIKE :q ESCAPE '\\'`, { q: likePattern(text) });
  }

  private applySort(
    qb: ReturnType<ArticlesService['visibleQuery']>,
    sort: 'moi' | 'cu' | 'ten',
  ): void {
    if (sort === 'cu') {
      qb.orderBy('article.publishedAt', 'ASC');
      return;
    }
    if (sort === 'ten') {
      qb.orderBy('article.title', 'ASC');
      return;
    }
    qb.orderBy('article.publishedAt', 'DESC');
  }

  private async counts(): Promise<Record<ArticleStatus, number>> {
    const rows = await this.articles
      .createQueryBuilder('article')
      .select('article.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('article.status')
      .getRawMany<{ status: ArticleStatus; count: string }>();
    const counts: Record<ArticleStatus, number> = {
      draft: 0,
      scheduled: 0,
      published: 0,
      hidden: 0,
    };
    for (const row of rows) counts[row.status] = Number(row.count);
    return counts;
  }

  async publishedFrequency(query: ArticleFrequencyQueryDto): Promise<{
    grain: ArticleFrequencyQueryDto['grain'];
    from: string;
    to: string;
    total: number;
    points: { bucket: string; count: number }[];
  }> {
    this.assertFrequencyRange(query);
    const pattern = FREQUENCY_PATTERN[query.grain];
    const rows = await this.articles.query<{ bucket: string; count: string }[]>(
      `SELECT to_char(date_trunc($1, published_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), $2) AS bucket,
              COUNT(*)::int AS count
       FROM articles
       WHERE deleted_at IS NULL
         AND status = 'published'
         AND published_at IS NOT NULL
         AND published_at >= $3
         AND published_at < $4
       GROUP BY 1
       ORDER BY 1`,
      [query.grain, pattern, zonedStart(query.grain, query.from), zonedStart(query.grain, nextBucket(query.grain, query.to))],
    );
    const found = new Map(rows.map((row) => [row.bucket, Number(row.count)]));
    const points: { bucket: string; count: number }[] = [];
    let cursor = query.from;
    while (cursor <= query.to && points.length < 400) {
      points.push({ bucket: cursor, count: found.get(cursor) ?? 0 });
      cursor = nextBucket(query.grain, cursor);
    }
    return {
      grain: query.grain,
      from: query.from,
      to: query.to,
      total: points.reduce((sum, point) => sum + point.count, 0),
      points,
    };
  }

  private assertFrequencyRange(query: ArticleFrequencyQueryDto): void {
    const pattern = query.grain === 'day' ? /^\d{4}-\d{2}-\d{2}$/ : query.grain === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}$/;
    if (!pattern.test(query.from) || !pattern.test(query.to) || query.from > query.to) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Khoảng thời gian không hợp lệ.');
    }
    let steps = 1;
    let cursor = query.from;
    while (cursor < query.to) {
      cursor = nextBucket(query.grain, cursor);
      steps += 1;
      if (steps > FREQUENCY_LIMIT[query.grain]) {
        throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Khoảng thời gian quá dài.');
      }
    }
  }

  private draftFrom(dto: ArticleWriteDto): ArticleDraft {
    return {
      title: dto.title.trim(),
      slug: dto.slug.trim(),
      lede: (dto.lede ?? '').trim(),
      body: dto.body ?? '',
      topic: dto.topic,
      status: dto.status,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      coverImage: dto.coverImage?.trim() || null,
      seoTitle: dto.seoTitle?.trim() || null,
      seoDescription: dto.seoDescription?.trim() || null,
    };
  }

  private assertIssues(draft: ArticleDraft): void {
    const issues = articleIssues(draft);
    if (issues.length) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, issues[0], issues);
    }
  }

  private async assertUnique(slug: string, title: string, exceptId?: string): Promise<void> {
    const slugOwner = await this.articles.findOne({ where: { slug }, withDeleted: true });
    if (slugOwner && slugOwner.id !== exceptId) {
      throw new BusinessException(ErrorCode.CONFLICT, 'Slug này đã dùng.');
    }
    const titleOwner = await this.articles
      .createQueryBuilder('article')
      .withDeleted()
      .where('article.title = :title', { title })
      .getOne();
    if (titleOwner && titleOwner.id !== exceptId) {
      throw new BusinessException(ErrorCode.CONFLICT, 'Đã có bài cùng tiêu đề.');
    }
  }

  private rowFrom(
    draft: ArticleDraft,
    source: ArticleEntity['source'],
    idempotencyKey: string | null,
    reviewNote: string | null,
    authorUserId: string | null,
  ): Partial<ArticleEntity> {
    return {
      ...draft,
      topic: isArticleTopic(draft.topic) ? draft.topic : 'cach-doc',
      source,
      idempotencyKey,
      reviewNote,
      authorUserId,
      searchText: searchTextOf(draft),
    };
  }

  private toPublic(row: ArticleEntity): ArticlePublicView {
    return {
      slug: row.slug,
      title: row.title,
      lede: row.lede,
      topic: row.topic,
      publishedAt: row.publishedAt,
      coverImage: row.coverImage,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
    };
  }

  private toAdmin(row: ArticleEntity): ArticleAdminView {
    return {
      ...this.toPublic(row),
      id: row.id,
      body: row.body,
      status: row.status,
      source: row.source,
      idempotencyKey: row.idempotencyKey,
      reviewNote: row.reviewNote,
      authorUserId: row.authorUserId,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }
}

function zonedStart(grain: ArticleFrequencyQueryDto['grain'], key: string): Date {
  if (grain === 'year') return new Date(`${key}-01-01T00:00:00+07:00`);
  if (grain === 'month') return new Date(`${key}-01T00:00:00+07:00`);
  return new Date(`${key}T00:00:00+07:00`);
}

function nextBucket(grain: ArticleFrequencyQueryDto['grain'], key: string): string {
  if (grain === 'year') return String(Number(key) + 1);
  if (grain === 'month') {
    const [year, month] = key.split('-').map(Number);
    if (month === 12) return `${year + 1}-01`;
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
  return code === '23505' || (error as { code?: string }).code === '23505';
}
