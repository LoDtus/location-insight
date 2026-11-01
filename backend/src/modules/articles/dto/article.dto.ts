import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsUUID,
  Matches,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ARTICLE_SOURCES,
  ARTICLE_STATUSES,
  ARTICLE_TOPICS,
} from '../article-rules.js';

export class ArticleWriteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  lede?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsIn(ARTICLE_TOPICS)
  topic: (typeof ARTICLE_TOPICS)[number];

  @IsIn(ARTICLE_STATUSES)
  status: (typeof ARTICLE_STATUSES)[number];

  @IsOptional()
  @IsISO8601()
  publishedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverImage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string | null;
}

export class IngestArticleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  idempotencyKey: string;

  @IsString()
  @MinLength(1)
  @MaxLength(140)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  lede?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsIn(ARTICLE_TOPICS)
  topic: (typeof ARTICLE_TOPICS)[number];

  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  requestedStatus?: (typeof ARTICLE_STATUSES)[number];

  @IsOptional()
  @IsISO8601()
  publishedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverImage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string | null;

  @IsOptional()
  @IsIn(ARTICLE_SOURCES)
  source?: (typeof ARTICLE_SOURCES)[number];
}

export class ArticleListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  topic?: string;

  @IsOptional()
  @IsIn([
    'moi',
    'cu',
    'ten',
    'updated_desc',
    'updated_asc',
    'published_desc',
    'published_asc',
    'title',
  ])
  sort?:
    | 'moi'
    | 'cu'
    | 'ten'
    | 'updated_desc'
    | 'updated_asc'
    | 'published_desc'
    | 'published_asc'
    | 'title';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 20, 50])
  pageSize?: number;
}

export class ArticlePositionQueryDto extends ArticleListQueryDto {
  @IsUUID()
  id: string;
}

export class ArticleFrequencyQueryDto {
  @IsIn(['day', 'month', 'year'])
  grain: 'day' | 'month' | 'year';

  @IsString()
  @Matches(/^\d{4}(-\d{2}(-\d{2})?)?$/)
  from: string;

  @IsString()
  @Matches(/^\d{4}(-\d{2}(-\d{2})?)?$/)
  to: string;
}
