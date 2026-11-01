import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'question', 'other'] as const;
export const FEEDBACK_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export class CreateFeedbackDto {
  @IsIn([...FEEDBACK_CATEGORIES])
  category: (typeof FEEDBACK_CATEGORIES)[number];

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  mediaIds?: string[];
}

export class FeedbackMediaDto {
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  byteSize: number;
}

export class FeedbackReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;
}

export class FeedbackStatusDto {
  @IsIn([...FEEDBACK_STATUSES])
  status: (typeof FEEDBACK_STATUSES)[number];
}

export class FeedbackListQueryDto {
  @IsOptional()
  @IsIn([...FEEDBACK_STATUSES])
  status?: (typeof FEEDBACK_STATUSES)[number];

  @IsOptional()
  @IsIn([...FEEDBACK_CATEGORIES])
  category?: (typeof FEEDBACK_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}
