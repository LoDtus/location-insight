import { Type } from 'class-transformer';
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
