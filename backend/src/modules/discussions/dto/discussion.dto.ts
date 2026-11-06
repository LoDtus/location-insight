import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { DISCUSSION_REPORT_REASONS, DISCUSSION_REPORT_STATUSES } from '../entities/discussion-report.entity.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  query?: string;

  @IsOptional()
  @IsIn(['following'])
  scope?: 'following';
}

export const AUTHOR_POST_SORTS = ['newest', 'interactions', 'oldest'] as const;
export type AuthorPostSort = (typeof AUTHOR_POST_SORTS)[number];

export class AuthorPostsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsIn(AUTHOR_POST_SORTS)
  sort?: AuthorPostSort;
}

export class CreateTopicDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(SLUG)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  summary?: string;
}

export class CreatePostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  topicSlug: string;

  @IsIn(['question', 'note'])
  kind: 'question' | 'note';

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('all', { each: true })
  mediaIds?: string[];
}

export class CreateReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('all', { each: true })
  mediaIds?: string[];
}

export class ReasonStatusDto {
  @IsIn(['open', 'locked', 'hidden'])
  status: 'open' | 'locked' | 'hidden';

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  reason: string;
}

export class HidePostDto {
  @IsBoolean()
  hidden: boolean;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  reason: string;
}

export class CreateMediaDto {
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  byteSize: number;
}

/** Báo cáo bài: lý do trong danh sách cố định, ghi chú tùy chọn. */
export class ReportPostDto {
  @IsIn(DISCUSSION_REPORT_REASONS)
  reason: (typeof DISCUSSION_REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReportListQueryDto {
  @IsOptional()
  @IsIn(DISCUSSION_REPORT_STATUSES)
  status?: (typeof DISCUSSION_REPORT_STATUSES)[number];
}

/** Xử lý báo cáo: `actioned` thì ẩn bài (cần lý do), `dismissed` thì giữ bài. */
export class ResolveReportDto {
  @IsIn(['actioned', 'dismissed'])
  status: 'actioned' | 'dismissed';

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  reason: string;
}

/** `ids=a,b,c`: tối đa 50 uuid. */
export class PresenceQueryDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  ids: string[];
}
