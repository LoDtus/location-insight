import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageService } from '../../integrations/storage/storage.service.js';
import {
  ConversationSearchQueryDto,
  SharedQueryDto,
} from './dto/messaging.dto.js';
import { MessagingAccessService } from './messaging-access.service.js';
import { readOptionsFor } from './messaging-attachments.service.js';
import { rowsOf } from './messaging-db.js';
import { invalid } from './messaging-errors.js';
import {
  FOLD_FROM,
  FOLD_TO,
  foldVietnamese,
  snippetAround,
} from './messaging-fold.js';
import { MessagingRateLimitService } from './messaging-rate-limit.service.js';
import { escapeLike, readCursor, writeCursor } from './messaging-rules.js';
import { MESSAGING_LIMITS } from './messaging.constants.js';

export interface SharedMediaItem {
  id: string;
  messageId: string;
  messageSeq: number;
  senderId: string;
  createdAt: string;
  contentType: string;
  width: number;
  height: number;
  url: string;
}

export interface SharedFileItem {
  id: string;
  messageId: string;
  messageSeq: number;
  senderId: string;
  createdAt: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  url: string;
}

export interface SharedLinkItem {
  messageId: string;
  messageSeq: number;
  senderId: string;
  createdAt: string;
  url: string;
  host: string;
}

export interface SearchHitItem {
  messageId: string;
  seq: number;
  senderId: string;
  createdAt: string;
  snippet: string;
}

interface AttachmentRow {
  id: string;
  message_seq: string;
  sort_order: number;
  object_key: string;
  kind: 'image' | 'file';
  content_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  file_name: string | null;
  message_id: string;
  sender_id: string;
  created_at: Date;
}

interface LinkRow {
  seq: string;
  message_id: string;
  sender_id: string;
  created_at: Date;
  url: string;
  ord: number;
}

interface SearchRow {
  seq: string;
  id: string;
  sender_id: string;
  body: string;
  created_at: Date;
}

/**
 * Nội dung đã gửi trong một hội thoại (ảnh, liên kết, tệp) và tìm tin trong hội thoại.
 * Chỉ đọc; luôn giới hạn trong phần mình còn được xem (`seq > cleared_before_seq`) và tin chưa thu hồi.
 */
@Injectable()
export class MessagingSharedService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: MessagingAccessService,
    private readonly rate: MessagingRateLimitService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string, conversationId: string, query: SharedQueryDto) {
    const m = await this.access.membership(userId, conversationId);
    await this.rate.consume('shared', `user_${userId}`);
    const limit = query.limit ?? MESSAGING_LIMITS.sharedPage;
    const floor = m.me.clearedBeforeSeq;
    if (query.type === 'links')
      return this.links(conversationId, floor, limit, query.cursor);
    return this.attachments(
      conversationId,
      floor,
      limit,
      query.type === 'media' ? 'image' : 'file',
      query.cursor,
    );
  }

  async search(
    userId: string,
    conversationId: string,
    query: ConversationSearchQueryDto,
  ) {
    const m = await this.access.membership(userId, conversationId);
    await this.rate.consume('search', `user_${userId}`);
    const folded = foldVietnamese(query.q.trim().replace(/\s+/g, ' '));
    if (folded.length < MESSAGING_LIMITS.conversationSearchMin)
      invalid('Nhập ít nhất 2 ký tự.');
    const limit = query.limit ?? MESSAGING_LIMITS.conversationSearchPage;
    const before = readCursor(query.cursor, 1);

    const rows = rowsOf<SearchRow>(
      await this.dataSource.query(
        `SELECT m.seq, m.id, m.sender_id, m.body, m.created_at
           FROM messages m
          WHERE m.conversation_id = $1 AND m.seq > $2 AND m.status = 'visible'
            AND m.kind IN ('text', 'image', 'file')
            AND translate(m.body, $3, $4) LIKE $5 ESCAPE '\\'
            AND ($6::bigint IS NULL OR m.seq < $6::bigint)
          ORDER BY m.seq DESC
          LIMIT $7`,
        [
          conversationId,
          m.me.clearedBeforeSeq,
          FOLD_FROM,
          FOLD_TO,
          `%${escapeLike(folded)}%`,
          before ? before[0] : null,
          limit + 1,
        ],
      ),
    );
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const items: SearchHitItem[] = slice.map((row) => ({
      messageId: row.id,
      seq: Number(row.seq),
      senderId: row.sender_id,
      createdAt: row.created_at.toISOString(),
      snippet: snippetAround(row.body, query.q.trim()),
    }));
    const last = slice.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? writeCursor([Number(last.seq)]) : null,
    };
  }

  private async attachments(
    conversationId: string,
    floor: number,
    limit: number,
    kind: 'image' | 'file',
    cursor?: string,
  ) {
    const point = readCursor(cursor, 2);
    const rows = rowsOf<AttachmentRow>(
      await this.dataSource.query(
        `SELECT a.id, a.message_seq, a.sort_order, a.object_key, a.kind, a.content_type, a.byte_size,
                a.width, a.height, a.file_name, m.id AS message_id, m.sender_id, m.created_at
           FROM message_attachments a
           JOIN messages m ON m.conversation_id = a.conversation_id AND m.seq = a.message_seq
          WHERE a.conversation_id = $1 AND a.kind = $2 AND a.status = 'ready' AND a.deleted_at IS NULL
            AND m.status = 'visible' AND m.seq > $3
            AND ($4::bigint IS NULL OR (a.message_seq, a.sort_order) < ($4::bigint, $5::int))
          ORDER BY a.message_seq DESC, a.sort_order DESC
          LIMIT $6`,
        [
          conversationId,
          kind,
          floor,
          point ? point[0] : null,
          point ? point[1] : null,
          limit + 1,
        ],
      ),
    );
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const urls = await Promise.all(
      slice.map((row) =>
        this.storage.getPresignedUrl(
          row.object_key,
          MESSAGING_LIMITS.readUrlTtlSeconds,
          readOptionsFor({
            kind: row.kind,
            fileName: row.file_name,
            contentType: row.content_type,
          }),
        ),
      ),
    );
    const items = slice.map((row, index) =>
      kind === 'image'
        ? ({
            id: row.id,
            messageId: row.message_id,
            messageSeq: Number(row.message_seq),
            senderId: row.sender_id,
            createdAt: row.created_at.toISOString(),
            contentType: row.content_type,
            width: row.width ?? 0,
            height: row.height ?? 0,
            url: urls[index] ?? '',
          } satisfies SharedMediaItem)
        : ({
            id: row.id,
            messageId: row.message_id,
            messageSeq: Number(row.message_seq),
            senderId: row.sender_id,
            createdAt: row.created_at.toISOString(),
            fileName: row.file_name ?? 'tep',
            contentType: row.content_type,
            byteSize: row.byte_size,
            url: urls[index] ?? '',
          } satisfies SharedFileItem),
    );
    const last = slice.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? writeCursor([Number(last.message_seq), last.sort_order])
          : null,
    };
  }

  /** Liên kết lấy trực tiếp từ nội dung tin (cả chú thích của ảnh và tệp), mới nhất trước; chỉ nhận http/https. */
  private async links(
    conversationId: string,
    floor: number,
    limit: number,
    cursor?: string,
  ) {
    const point = readCursor(cursor, 2);
    const rows = rowsOf<LinkRow>(
      await this.dataSource.query(
        `SELECT m.seq, m.id AS message_id, m.sender_id, m.created_at, l.url, l.ord
           FROM messages m
          CROSS JOIN LATERAL (
            SELECT x.parts[1] AS url, x.ord::int AS ord
              FROM regexp_matches(m.body, '(https?://[^\\s<>"'']+[^\\s<>"''.,;:!?)])', 'g')
                   WITH ORDINALITY AS x(parts, ord)
          ) l
          WHERE m.conversation_id = $1 AND m.status = 'visible' AND m.kind IN ('text', 'image', 'file') AND m.seq > $2
            AND ($3::bigint IS NULL OR (m.seq, l.ord) < ($3::bigint, $4::int))
          ORDER BY m.seq DESC, l.ord DESC
          LIMIT $5`,
        [
          conversationId,
          floor,
          point ? point[0] : null,
          point ? point[1] : null,
          limit + 1,
        ],
      ),
    );
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const items: SharedLinkItem[] = slice.flatMap((row) => {
      const host = hostOf(row.url);
      return host
        ? [
            {
              messageId: row.message_id,
              messageSeq: Number(row.seq),
              senderId: row.sender_id,
              createdAt: row.created_at.toISOString(),
              url: row.url,
              host,
            },
          ]
        : [];
    });
    const last = slice.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last ? writeCursor([Number(last.seq), last.ord]) : null,
    };
  }
}

/** Tên miền để hiển thị; null nếu không phải http/https hợp lệ. */
export function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return null;
    return parsed.hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}
