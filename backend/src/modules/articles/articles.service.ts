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
  ArticleListQueryDto,
  ArticleWriteDto,
  IngestArticleDto,
} from './dto/article.dto.js';
import { ArticleEntity } from './entities/article.entity.js';

const PUBLIC_PAGE_SIZE = 6;
const ADMIN_PAGE_SIZE = 10;

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
  ) {}

  async listPublic(query: ArticleListQueryDto) {
    const page = query.page ?? 1;
    const qb = this.visibleQuery();
    this.applySearch(qb, query.q);
    if (query.topic && isArticleTopic(query.topic)) {
      qb.andWhere('article.topic = :topic', { topic: query.topic });
    }
    this.applySort(qb, query.sort ?? 'moi');
    qb.take(PUBLIC_PAGE_SIZE).skip((page - 1) * PUBLIC_PAGE_SIZE);
    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((row) => this.toPublic(row)),
      page,
      pageSize: PUBLIC_PAGE_SIZE,
      total,
    };
  }

  async getPublic(slug: string): Promise<ArticlePublicView & { body: string }> {
    const row = await this.visibleQuery()
      .andWhere('article.slug = :slug', { slug })
      .getOne();
    if (!row) throw new NotFoundException('Không có bài này.');
    return { ...this.toPublic(row), body: row.body };
  }

  async listAdmin(query: ArticleListQueryDto) {
    const page = query.page ?? 1;
    const qb = this.articles.createQueryBuilder('article');
    if (query.status === 'deleted') {
      qb.withDeleted().where('article.deletedAt IS NOT NULL');
    } else if (query.status) {
      qb.where('article.status = :status', { status: query.status });
    }
    this.applySearch(qb, query.q);
    qb.orderBy('article.updatedAt', 'DESC');
    qb.take(ADMIN_PAGE_SIZE).skip((page - 1) * ADMIN_PAGE_SIZE);
    const [rows, total] = await qb.getManyAndCount();
    const counts = await this.counts();
    return {
      items: rows.map((row) => this.toAdmin(row)),
      page,
      pageSize: ADMIN_PAGE_SIZE,
      total,
      counts,
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

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
  return code === '23505' || (error as { code?: string }).code === '23505';
}
