import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_IMAGE_TYPES,
  MESSAGING_LIMITS,
} from '../messaging.constants.js';

const ATTACHMENT_TYPES: string[] = [
  ...ALLOWED_IMAGE_TYPES,
  ...Object.keys(ALLOWED_FILE_TYPES),
];

export class ListConversationsQueryDto {
  @IsOptional()
  @IsIn(['inbox', 'requests'])
  folder?: 'inbox' | 'requests';

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
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

export class CreateConversationDto {
  @IsUUID()
  userId: string;
}

export class ReadDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seq: number;
}

export class MuteDto {
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  until: string | null;
}

export class ListMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeSeq?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterSeq?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGING_LIMITS.pageMax)
  limit?: number;
}

export class SendMessageDto {
  @IsUUID()
  clientMsgId: string;

  @IsIn(['text', 'image', 'file', 'post_share'])
  kind: 'text' | 'image' | 'file' | 'post_share';

  @IsOptional()
  @IsString()
  @MaxLength(MESSAGING_LIMITS.bodyMax)
  body?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  replyToSeq?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MESSAGING_LIMITS.attachmentsMax)
  @IsUUID('all', { each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsUUID()
  postId?: string;
}

export class ReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji: string;
}

export class ReportMessageDto {
  @IsIn(['spam', 'scam', 'harassment', 'sexual', 'other'])
  reasonCode: 'spam' | 'scam' | 'harassment' | 'sexual' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateAttachmentDto {
  @IsUUID()
  conversationId: string;

  /** Ảnh (jpeg/png/webp) hoặc tệp tài liệu (pdf, docx, xlsx, pptx, txt, csv). */
  @IsIn(ATTACHMENT_TYPES)
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGING_LIMITS.fileMaxBytes)
  byteSize: number;

  /** Bắt buộc với tệp tài liệu, bỏ qua với ảnh. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

export class CompleteAttachmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGING_LIMITS.imageSideMax)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGING_LIMITS.imageSideMax)
  height?: number;
}

export class RecipientsQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  q: string;
}

export class PreferencesDto {
  @IsOptional()
  @IsIn(['everyone', 'nobody'])
  whoCanMessage?: 'everyone' | 'nobody';

  @IsOptional()
  @IsBoolean()
  showActivityStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  sendReadReceipts?: boolean;
}

export class AdminReportsQueryDto {
  @IsOptional()
  @IsIn(['open', 'dismissed', 'actioned'])
  status?: 'open' | 'dismissed' | 'actioned';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}

export class ResolveReportDto {
  @IsIn(['dismiss', 'hide_message'])
  action: 'dismiss' | 'hide_message';

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  reason: string;
}

export class PinDto {
  @IsBoolean()
  pinned: boolean;
}

export class NicknameDto {
  /** null hoặc chuỗi rỗng để xóa biệt danh. */
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(MESSAGING_LIMITS.nicknameMax * 2)
  nickname: string | null;
}

export class SharedQueryDto {
  @IsIn(['media', 'links', 'files'])
  type: 'media' | 'links' | 'files';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGING_LIMITS.sharedPageMax)
  limit?: number;
}

export class ConversationSearchQueryDto {
  @IsString()
  @MinLength(MESSAGING_LIMITS.conversationSearchMin)
  @MaxLength(MESSAGING_LIMITS.conversationSearchMax)
  q: string;

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
