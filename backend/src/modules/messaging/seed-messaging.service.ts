import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { v5 as uuidv5, v7 as uuidv7 } from 'uuid';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { DiscussionPostEntity } from '../discussions/entities/discussion-post.entity.js';
import { ConversationParticipantEntity } from './entities/conversation-participant.entity.js';
import { ConversationEntity } from './entities/conversation.entity.js';
import { ConversationDeleteRequestEntity } from './entities/conversation-delete-request.entity.js';
import { MessageAttachmentEntity } from './entities/message-attachment.entity.js';
import { MessageReactionEntity } from './entities/message-reaction.entity.js';
import { MessageEntity } from './entities/message.entity.js';
import { rowsOf } from './messaging-db.js';
import { directKey, previewFor, UNSENT_PREVIEW } from './messaging-rules.js';
import { MESSAGING_KEYS } from './messaging.constants.js';
import {
  SEED_IMAGE_SIZE,
  SEED_PALETTE,
  SEED_TEXT_FILES,
  seedPdf,
  seedPng,
} from './seed-media.js';
import {
  SEED_ADMIN_CONVERSATIONS,
  SEED_CONVERSATIONS,
  SeedConversation,
  SeedMessage,
  Side,
} from './seed.config.js';

/** Không gian tên cố định để tin bổ sung có clientMsgId ổn định giữa các lần khởi động. */
const EXTRA_NAMESPACE = '6f2f0b8e-3c1a-4d5e-9a77-0c4b6d1e2a90';

interface PreparedAttachment {
  id: string;
  objectKey: string;
  kind: 'image' | 'file';
  contentType: string;
  fileName: string | null;
  width: number | null;
  height: number | null;
  bytes: Buffer;
}

/** Hội thoại mẫu cho môi trường dev: chạy một lần, bỏ qua nếu đã có hội thoại giữa hai tài khoản mẫu. */
@Injectable()
export class SeedMessagingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedMessagingService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
    @InjectRepository(DiscussionPostEntity)
    private readonly posts: Repository<DiscussionPostEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    try {
      await this.seed();
    } catch (error) {
      this.logger.warn(
        `Chưa tạo được hội thoại mẫu: ${error instanceof Error ? error.message : 'không rõ'}`,
      );
    }
  }

  private async seed(): Promise<void> {
    const all = [...SEED_CONVERSATIONS, ...SEED_ADMIN_CONVERSATIONS];
    const emails = [...new Set(all.flatMap((item) => [item.a, item.b]))];
    const people = await this.users.find({ where: { email: In(emails) } });
    const byEmail = new Map(people.map((user) => [user.email, user]));
    const post = await this.posts.findOne({
      where: { status: 'visible', rootId: IsNull() },
      order: { createdAt: 'DESC' },
    });

    let created = 0;
    for (const spec of all) {
      const a = byEmail.get(spec.a);
      const b = byEmail.get(spec.b);
      if (!a || !b) continue;
      const key = directKey(a.id, b.id);
      if (!(await this.conversations.exists({ where: { directKey: key } }))) {
        await this.createConversation(spec, a.id, b.id, key, post?.id ?? null);
        created += 1;
      }
      await this.ensureExtras(spec, a.id, b.id, key);
    }
    if (created) this.logger.log(`Đã tạo ${created} hội thoại mẫu.`);
  }

  private async createConversation(
    spec: SeedConversation,
    aId: string,
    bId: string,
    key: string,
    postId: string | null,
  ): Promise<void> {
    const id = (side: Side): string => (side === 'a' ? aId : bId);
    const now = Date.now();
    const rows = spec.messages
      .map((item, index) => ({ ...item, index: index + 1 }))
      .filter((item) => !item.share || postId)
      .sort((x, y) => y.ago - x.ago || x.index - y.index);
    const seqByIndex = new Map(
      rows.map((item, position) => [item.index, position + 1]),
    );
    const last = rows.at(-1);
    if (!last) return;
    const first = rows[0];
    const lastSeq = rows.length;
    const lastAt = new Date(now - last.ago * 60_000);
    const readOf = (side: Side): number => {
      const own = rows.reduce(
        (max, item, position) => (item.from === side ? position + 1 : max),
        0,
      );
      return Math.max(own, lastSeq - (spec.unread?.[side] ?? 0));
    };
    const lastLive = last.unsent
      ? UNSENT_PREVIEW
      : previewFor(last.share ? 'post_share' : 'text', last.text ?? '');
    const conversationId = uuidv7();

    await this.dataSource.transaction(async (manager) => {
      await manager.insert(ConversationEntity, {
        id: conversationId,
        type: 'direct',
        state: spec.state ?? 'active',
        directKey: key,
        initiatorId: id(first?.from ?? 'a'),
        lastSeq,
        lastMessageAt: lastAt,
        lastSenderId: id(last.from),
        lastMessagePreview: lastLive,
      });
      await manager.insert(
        ConversationParticipantEntity,
        (['a', 'b'] as const).map((side) => ({
          conversationId,
          userId: id(side),
          role: 'member' as const,
          lastReadSeq: readOf(side),
          lastActivityAt: lastAt,
          mutedUntil:
            spec.mutedBy === side ? new Date('9999-12-31T00:00:00.000Z') : null,
        })),
      );

      for (const [position, item] of rows.entries()) {
        const seq = position + 1;
        const reply = item.reply ? seqByIndex.get(item.reply) : undefined;
        const kind = item.share ? 'post_share' : 'text';
        await manager.insert(MessageEntity, {
          conversationId,
          seq,
          id: uuidv7(),
          senderId: id(item.from),
          kind,
          body: item.unsent ? '' : item.share ? '' : (item.text ?? ''),
          replyToSeq: reply ?? null,
          sharedPostId: item.share ? postId : null,
          clientMsgId: uuidv7(),
          status: item.unsent ? 'deleted' : 'visible',
          createdAt: new Date(now - item.ago * 60_000),
          deletedAt: item.unsent
            ? new Date(now - item.ago * 60_000 + 60_000)
            : null,
        });
        for (const [side, emoji] of item.reactions ?? []) {
          await manager.insert(MessageReactionEntity, {
            conversationId,
            messageSeq: seq,
            userId: id(side),
            emoji,
          });
        }
      }
    });
  }

  /**
   * Chèn ảnh, tệp, liên kết mẫu vào hội thoại (cả hội thoại đã tồn tại từ trước). Mỗi tin có clientMsgId cố định
   * nên chạy lại không tạo trùng. Ghim, biệt danh và yêu cầu xóa lịch sử chỉ đặt ở lần chèn đầu tiên,
   * để không ghi đè lựa chọn người dùng đã thay đổi sau đó.
   */
  private async ensureExtras(
    spec: SeedConversation,
    aId: string,
    bId: string,
    key: string,
  ): Promise<void> {
    const extras = spec.extras;
    if (!extras?.length) return;
    const conversation = await this.conversations.findOne({
      where: { directKey: key },
    });
    if (!conversation) return;
    const idOf = (side: Side): string => (side === 'a' ? aId : bId);

    const clientIds = extras.map((_, index) =>
      uuidv5(`${key}:extra:${index}`, EXTRA_NAMESPACE),
    );
    const present = new Set(
      rowsOf<{ client_msg_id: string }>(
        await this.dataSource.query(
          `SELECT client_msg_id FROM messages WHERE conversation_id = $1 AND client_msg_id = ANY($2::uuid[])`,
          [conversation.id, clientIds],
        ),
      ).map((row) => row.client_msg_id),
    );
    const todo = extras
      .map((extra, index) => ({
        extra,
        clientMsgId: clientIds[index] as string,
      }))
      .filter((item) => !present.has(item.clientMsgId));
    if (!todo.length) return;
    const firstRun = todo.length === extras.length;

    const prepared = new Map<string, PreparedAttachment[]>();
    let palette = 0;
    for (const item of todo) {
      const list = this.attachmentsFor(
        conversation.id,
        item.extra,
        () => palette++,
      );
      for (const attachment of list) {
        await this.storage.putObject(
          attachment.objectKey,
          attachment.bytes,
          attachment.contentType,
        );
      }
      prepared.set(item.clientMsgId, list);
    }
    const kindOf = (files: PreparedAttachment[]): 'file' | 'image' | 'text' =>
      files.some((f) => f.kind === 'file')
        ? 'file'
        : files.length
          ? 'image'
          : 'text';

    const now = Date.now();
    const lastRead: Record<Side, number> = { a: 0, b: 0 };
    let lastSeq = 0;
    await this.dataSource.transaction(async (manager) => {
      const locked = rowsOf<{ last_seq: string }>(
        await manager.query(
          `UPDATE conversations SET last_seq = last_seq + $2, updated_at = now() WHERE id = $1 RETURNING last_seq`,
          [conversation.id, todo.length],
        ),
      )[0];
      lastSeq = Number(locked?.last_seq ?? 0);
      const first = lastSeq - todo.length + 1;

      for (const [position, item] of todo.entries()) {
        const seq = first + position;
        const files = prepared.get(item.clientMsgId) ?? [];
        await manager.insert(MessageEntity, {
          conversationId: conversation.id,
          seq,
          id: uuidv7(),
          senderId: idOf(item.extra.from),
          kind: kindOf(files),
          body: item.extra.text ?? '',
          replyToSeq: null,
          sharedPostId: null,
          clientMsgId: item.clientMsgId,
          status: 'visible',
          createdAt: new Date(now - item.extra.ago * 60_000),
          deletedAt: null,
        });
        for (const [order, file] of files.entries()) {
          await manager.insert(MessageAttachmentEntity, {
            id: file.id,
            conversationId: conversation.id,
            messageSeq: seq,
            uploaderId: idOf(item.extra.from),
            objectKey: file.objectKey,
            kind: file.kind,
            contentType: file.contentType,
            fileName: file.fileName,
            byteSize: file.bytes.length,
            width: file.width,
            height: file.height,
            sortOrder: order,
            status: 'ready',
          });
        }
        for (const [side, emoji] of item.extra.reactions ?? []) {
          await manager.insert(MessageReactionEntity, {
            conversationId: conversation.id,
            messageSeq: seq,
            userId: idOf(side),
            emoji,
          });
        }
        lastRead[item.extra.from] = seq;
      }

      const last = todo[todo.length - 1] as (typeof todo)[number];
      const lastAt = new Date(now - last.extra.ago * 60_000);
      await manager.query(
        `UPDATE conversations SET last_message_at = $2, last_sender_id = $3, last_message_preview = $4 WHERE id = $1`,
        [
          conversation.id,
          lastAt,
          idOf(last.extra.from),
          previewFor(
            kindOf(prepared.get(last.clientMsgId) ?? []),
            last.extra.text ?? '',
          ),
        ],
      );
      for (const side of ['a', 'b'] as const) {
        await manager.query(
          `UPDATE conversation_participants
              SET last_activity_at = $3, last_read_seq = GREATEST(last_read_seq, $4::bigint)
            WHERE conversation_id = $1 AND user_id = $2`,
          [conversation.id, idOf(side), lastAt, lastRead[side]],
        );
      }

      if (!firstRun) return;
      if (spec.pinnedBy) {
        await manager.update(
          ConversationParticipantEntity,
          { conversationId: conversation.id, userId: idOf(spec.pinnedBy) },
          { pinnedAt: new Date() },
        );
      }
      for (const side of ['a', 'b'] as const) {
        const nickname = spec.nicknames?.[side];
        if (!nickname) continue;
        await manager.update(
          ConversationParticipantEntity,
          { conversationId: conversation.id, userId: idOf(side) },
          { peerNickname: nickname },
        );
      }
      if (spec.deleteRequestBy) {
        await manager.insert(ConversationDeleteRequestEntity, {
          id: uuidv7(),
          conversationId: conversation.id,
          requesterId: idOf(spec.deleteRequestBy),
          upToSeq: lastSeq,
          status: 'pending',
        });
      }
    });
    // Số chưa đọc trong Redis có thể còn bản cũ tối đa 5 phút.
    await this.redis
      .getClient()
      .del(MESSAGING_KEYS.unread(aId), MESSAGING_KEYS.unread(bId))
      .catch(() => undefined);
    this.logger.log(
      `Đã thêm ${todo.length} tin mẫu (ảnh, tệp, liên kết) vào một hội thoại.`,
    );
  }

  private attachmentsFor(
    conversationId: string,
    extra: SeedMessage,
    nextPalette: () => number,
  ): PreparedAttachment[] {
    const out: PreparedAttachment[] = [];
    for (let i = 0; i < (extra.images ?? 0); i += 1) {
      const [from, to] = SEED_PALETTE[
        nextPalette() % SEED_PALETTE.length
      ] as (typeof SEED_PALETTE)[number];
      const id = uuidv7();
      out.push({
        id,
        objectKey: `messaging/${conversationId}/${id}.png`,
        kind: 'image',
        contentType: 'image/png',
        fileName: null,
        width: SEED_IMAGE_SIZE.width,
        height: SEED_IMAGE_SIZE.height,
        bytes: seedPng(from, to),
      });
    }
    if (extra.file) {
      const id = uuidv7();
      const specs = {
        pdf: {
          type: 'application/pdf',
          ext: 'pdf',
          bytes: seedPdf('Hop dong dat coc - ban mau'),
        },
        note: { type: 'text/plain', ext: 'txt', bytes: SEED_TEXT_FILES.note },
        prices: { type: 'text/csv', ext: 'csv', bytes: SEED_TEXT_FILES.prices },
      } as const;
      const chosen = specs[extra.file.kind];
      out.push({
        id,
        objectKey: `messaging/${conversationId}/${id}.${chosen.ext}`,
        kind: 'file',
        contentType: chosen.type,
        fileName: extra.file.name,
        width: null,
        height: null,
        bytes: chosen.bytes,
      });
    }
    return out;
  }
}
