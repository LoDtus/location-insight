import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
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
import { EMAIL_LIMITS, EMAIL_LOCALES, EMAIL_STATUSES, OPTIONAL_CATEGORIES } from '../email.constants.js';

export class SaveTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(EMAIL_LIMITS.subjectMax)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(EMAIL_LIMITS.bodyHtmlMax)
  bodyHtml: string;

  @IsOptional()
  @IsString()
  @MaxLength(EMAIL_LIMITS.bodyTextMax)
  bodyText?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class PreviewTemplateDto {
  @IsOptional()
  @IsIn([...EMAIL_LOCALES])
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EMAIL_LIMITS.subjectMax)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EMAIL_LIMITS.bodyHtmlMax)
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EMAIL_LIMITS.bodyTextMax)
  bodyText?: string | null;
}

export class TestTemplateDto {
  @IsOptional()
  @IsIn([...EMAIL_LOCALES])
  locale?: string;
}

export class TemplateQueryDto {
  @IsOptional()
  @IsIn([...EMAIL_LOCALES])
  locale?: string;
}

export class MessagesQueryDto {
  @IsOptional()
  @IsIn([...EMAIL_STATUSES])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  template?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class SuppressionDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class PreferenceDto {
  @IsIn([...OPTIONAL_CATEGORIES])
  category: (typeof OPTIONAL_CATEGORIES)[number];

  @IsBoolean()
  enabled: boolean;
}

export class UnsubscribeQueryDto {
  @IsUUID()
  u: string;

  @IsString()
  @MaxLength(20)
  c: string;

  @IsString()
  @MaxLength(100)
  t: string;
}
