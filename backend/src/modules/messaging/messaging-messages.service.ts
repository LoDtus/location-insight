import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { DiscussionPostEntity } from '../discussions/entities/discussion-post.entity.js';
import { ListMessagesQueryDto, SendMessageDto } from './dto/messaging.dto.js';
import { MessagingAccessService } from './messaging-access.service.js';
import { MessagingConversationsService } from './messaging-conversations.service.js';
import { rowsOf } from './messaging-db.js';
import { cannotMessage, forbidden, invalid, notFound, requestPending } from './messaging-errors.js';
import { MessagingEventsService } from './messaging-events.service.js';
import { MessageView, MessagingPresenterService } from './messaging-presenter.service.js';
import { MessagingRateLimitService } from './messaging-rate-limit.service.js';
import {
  ConversationState,
  MessageKind,
  UNSENT_PREVIEW,
  previewFor,
  sendGate,
} from './messaging-rules.js';
import { cleanMessage } from './messaging-text.js';
import {
  ALLOWED_REACTIONS,
  MESSAGING_CHANNELS,
  MESSAGING_LIMITS,
} from './messaging.constants.js';
import { MessageReactionEntity } from './entities/message-reaction.entity.js';
import { MessageEntity } from './entities/message.entity.js';

class ReplaySignal extends Error {}

@Injectable()
export class MessagingMessagesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: MessagingAccessService,
    private readonly presenter: MessagingPresenterService,
    private readonly events: MessagingEventsService,
    private readonly rate: MessagingRateLimitService,
    private readonly conversations: MessagingConversationsService,
    @InjectRepository(MessageEntity)
    private readonly messages: Repository<MessageEntity>,
    @InjectRepository(MessageReactionEntity)
    private readonly reactions: Repository<MessageReactionEntity>,
    @InjectRepository(DiscussionPostEntity)
    private readonly posts: Repository<DiscussionPostEntity>,
  ) {}

  async list(userId: string, conversationId: string, query: ListMessagesQueryDto) {
    const m = await this.access.membership(userId, conversationId);
    if (query.beforeSeq !== undefined && query.afterSeq !== undefined) {
      invalid('Chỉ dùng một trong beforeSeq và afterSeq.');
    }
    const limit = query.limit ?? MESSAGING_LIMITS.pageDefault;
    const floor = m.me.clearedBeforeSeq;
    const base = this.messages
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId })
      .andWhere('m.seq > :floor', { floor });

    let rows: MessageEntity[];
    let hasMoreBefore: boolean;
    let hasMoreAfter: boolean;
    if (query.afterSeq !== undefined) {
      rows = await base
        .andWhere('m.seq > :after', { after: query.afterSeq })
        .orderBy('m.seq', 'ASC')
        .take(limit + 1)
        .getMany();
      hasMoreAfter = rows.length > limit;
      rows = hasMoreAfter ? rows.slice(0, limit) : rows;
      hasMoreBefore = query.afterSeq > floor;
    } else {
      if (query.beforeSeq !== undefined) {
        base.andWhere('m.seq < :before', { before: query.beforeSeq });
      }
      const found = await base.orderBy('m.seq', 'DESC').take(limit + 1).getMany();
      hasMoreBefore = found.length > limit;
      rows = (hasMoreBefore ? found.slice(0, limit) : found).reverse();
      hasMoreAfter = query.beforeSeq !== undefined;
    }
    const items = await this.presenter.messageViews(rows, userId);
    const prefs = await this.access.preferencesMany([userId, m.peerId]);
    const receipts = prefs.get(userId)?.sendReadReceipts && prefs.get(m.peerId)?.sendReadReceipts;
    const peer = receipts ? await this.peerRead(conversationId, m.peerId) : null;
    return {
      items,
      hasMoreBefore,
      hasMoreAfter,
      lastSeq: m.conversation.lastSeq,
      peerLastReadSeq: peer,
    };
  }

  async send(
    userId: string,
    conversationId: string,
    input: SendMessageDto,
  ): Promise<{ message: MessageView; created: boolean }> {
    const m = await this.access.membership(userId, conversationId);
    await this.access.assertSenderAllowed(userId);
    const prepared = this.prepare(input);

    const replay = await this.messages.findOne({
      where: { conversationId, senderId: userId, clientMsgId: input.clientMsgId },
    });
    if (replay) return { message: await this.view(replay, userId), created: false };

    await this.access.assertPeerReachable(userId, m.peerId);
    const gate = sendGate({
      state: m.conversation.state,
      iAmInitiator: m.conversation.initiatorId === userId,
      lastSeq: m.conversation.lastSeq,
      kind: prepared.kind,
    });
    if (gate === 'request_pending') requestPending();
    if (gate === 'request_text_only') {
      invalid('Chỉ gửi được một tin chữ cho đến khi người này chấp nhận.');
    }
    await this.rate.consume('send', `user_${userId}`);
    await this.rate.consume('sendConversation', `conv_${conversationId}:user_${userId}`);

    if (input.replyToSeq) await this.assertReplyTarget(conversationId, input.replyToSeq, m.me.clearedBeforeSeq);
    if (prepared.kind === 'post_share') await this.assertPostVisible(input.postId as string);

    let seq = 0;
    let activated = false;
    try {
      ({ seq, activated } = await this.dataSource.transaction((manager) =>
        this.insert(manager, {
          userId,
          conversationId,
          peerId: m.peerId,
          input,
          kind: prepared.kind,
          body: prepared.body,
        }),
      ));
    } catch (error) {
      if (error instanceof ReplaySignal) {
        const existing = await this.messages.findOneOrFail({
          where: { conversationId, senderId: userId, clientMsgId: input.clientMsgId },
        });
        return { message: await this.view(existing, userId), created: false };
      }
      throw error;
    }

    const row = await this.messages.findOneByOrFail({ conversationId, seq });
    const message = await this.view(row, userId);
    const members = [userId, m.peerId];
    await this.conversations.invalidateUnread(members);
    const state: ConversationState = activated ? 'active' : m.conversation.state;
    await this.events.publish(MESSAGING_CHANNELS.messageCreated, members, {
      conversationId,
      state,
      initiatorId: m.conversation.initiatorId,
      message,
    });
    if (activated) {
      await this.events.publish(MESSAGING_CHANNELS.conversationUpdated, members, {
        conversationId,
        reason: 'accepted',
      });
    }
    await this.events.publish(MESSAGING_CHANNELS.unread, [m.peerId], {});
    return { message, created: true };
  }

  async unsend(userId: string, conversationId: string, messageId: string): Promise<void> {
    const m = await this.access.membership(userId, conversationId);
    const target = await this.messages.findOne({ where: { conversationId, id: messageId } });
    if (!target || target.seq <= m.me.clearedBeforeSeq) notFound('Không tìm thấy tin nhắn.');
    if (target.senderId !== userId) forbidden('Bạn chỉ thu hồi được tin của mình.');
    if (target.status === 'deleted') return;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        MessageEntity,
        { conversationId, seq: target.seq },
        { status: 'deleted', body: '', deletedAt: new Date() },
      );
      await manager.delete(MessageReactionEntity, { conversationId, messageSeq: target.seq });
      if (target.seq === m.conversation.lastSeq) {
        await manager.query(
          `UPDATE conversations SET last_message_preview = $2, updated_at = now() WHERE id = $1`,
          [conversationId, UNSENT_PREVIEW],
        );
      }
    });
    const members = [userId, m.peerId];
    await this.conversations.invalidateUnread(members);
    await this.events.publish(MESSAGING_CHANNELS.messageUpdated, members, {
      conversationId,
      seq: target.seq,
      change: 'deleted',
    });
    await this.events.publish(MESSAGING_CHANNELS.unread, members, {});
  }

  async react(userId: string, conversationId: string, messageId: string, emoji: string): Promise<void> {
    if (!(ALLOWED_REACTIONS as readonly string[]).includes(emoji)) {
      invalid('Cảm xúc này không được hỗ trợ.');
    }
    const { target, peerId } = await this.reactable(userId, conversationId, messageId);
    await this.rate.consume('react', `user_${userId}`);
    const before = await this.reactions.findOne({
      where: { conversationId, messageSeq: target.seq, userId },
    });
    await this.reactions.query(
      `INSERT INTO message_reactions (conversation_id, message_seq, user_id, emoji, created_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (conversation_id, message_seq, user_id) DO UPDATE SET emoji = EXCLUDED.emoji`,
      [conversationId, target.seq, userId, emoji],
    );
    await this.events.publish(MESSAGING_CHANNELS.reactionChanged, [userId, peerId], {
      conversationId,
      seq: target.seq,
      userId,
      emoji,
      previousEmoji: before?.emoji ?? null,
    });
  }

  async unreact(userId: string, conversationId: string, messageId: string): Promise<void> {
    const { target, peerId } = await this.reactable(userId, conversationId, messageId);
    const before = await this.reactions.findOne({
      where: { conversationId, messageSeq: target.seq, userId },
    });
    if (!before) return;
    await this.reactions.delete({ conversationId, messageSeq: target.seq, userId });
    await this.events.publish(MESSAGING_CHANNELS.reactionChanged, [userId, peerId], {
      conversationId,
      seq: target.seq,
      userId,
      emoji: null,
      previousEmoji: before.emoji,
    });
  }

  private async reactable(userId: string, conversationId: string, messageId: string) {
    const m = await this.access.membership(userId, conversationId);
    const target = await this.messages.findOne({ where: { conversationId, id: messageId } });
    if (!target || target.seq <= m.me.clearedBeforeSeq) notFound('Không tìm thấy tin nhắn.');
    if (target.status !== 'visible') invalid('Không thể thả cảm xúc trên tin đã thu hồi.');
    if (await this.access.isBlockedEither(userId, m.peerId)) cannotMessage();
    return { target, peerId: m.peerId };
  }

  private async insert(
    manager: DataSource['manager'],
    args: {
      userId: string;
      conversationId: string;
      peerId: string;
      input: SendMessageDto;
      kind: MessageKind;
      body: string;
    },
  ): Promise<{ seq: number; activated: boolean }> {
    const { userId, conversationId, input, kind, body } = args;
    // Khóa dòng hội thoại: các tin cùng hội thoại xếp hàng, hội thoại khác không bị ảnh hưởng.
    const locked = rowsOf<{ last_seq: string; state: ConversationState; initiator_id: string }>(
      await manager.query(
        `UPDATE conversations SET last_seq = last_seq + 1, updated_at = now()
         WHERE id = $1 RETURNING last_seq, state, initiator_id`,
        [conversationId],
      ),
    )[0];
    if (!locked) notFound('Không tìm thấy hội thoại.');
    const seq = Number(locked.last_seq);
    const recheck = sendGate({
      state: locked.state,
      iAmInitiator: locked.initiator_id === userId,
      lastSeq: seq - 1,
      kind,
    });
    if (recheck === 'request_pending') requestPending();
    if (recheck === 'request_text_only') invalid('Chỉ gửi được một tin chữ cho đến khi người này chấp nhận.');

    const inserted = rowsOf<{ created_at: Date }>(
      await manager.query(
        `INSERT INTO messages (conversation_id, seq, id, sender_id, kind, body, reply_to_seq, shared_post_id, client_msg_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'visible', now())
         ON CONFLICT (conversation_id, sender_id, client_msg_id) DO NOTHING
         RETURNING created_at`,
        [
          conversationId,
          seq,
          uuidv7(),
          userId,
          kind,
          body,
          input.replyToSeq ?? null,
          kind === 'post_share' ? (input.postId ?? null) : null,
          input.clientMsgId,
        ],
      ),
    );
    if (!inserted.length) throw new ReplaySignal();

    if (kind === 'image') {
      const ids = input.attachmentIds as string[];
      const claimed = rowsOf<{ id: string }>(
        await manager.query(
          `UPDATE message_attachments
           SET message_seq = $1, sort_order = array_position($2::uuid[], id) - 1, updated_at = now()
           WHERE id = ANY($2::uuid[]) AND uploader_id = $3 AND conversation_id = $4
             AND status = 'ready' AND message_seq IS NULL AND deleted_at IS NULL
           RETURNING id`,
          [seq, ids, userId, conversationId],
        ),
      );
      if (claimed.length !== ids.length) invalid('Có ảnh chưa sẵn sàng hoặc không phải của bạn.');
    }

    const now = new Date();
    await manager.query(
      `UPDATE conversation_participants
       SET last_activity_at = $2, hidden_at = NULL,
           last_read_seq = CASE WHEN user_id = $3 THEN $4::bigint ELSE last_read_seq END
       WHERE conversation_id = $1 AND left_at IS NULL`,
      [conversationId, now, userId, seq],
    );
    const activated = locked.state !== 'active' && locked.initiator_id !== userId;
    await manager.query(
      `UPDATE conversations
       SET last_message_at = $2, last_sender_id = $3, last_message_preview = $4,
           state = CASE WHEN state <> 'active' AND initiator_id <> $3 THEN 'active' ELSE state END
       WHERE id = $1`,
      [conversationId, now, userId, previewFor(kind, body)],
    );
    return { seq, activated };
  }

  private prepare(input: SendMessageDto): { kind: MessageKind; body: string } {
    const body = cleanMessage(input.body ?? '');
    if (input.kind === 'text') {
      if (!body) invalid('Nội dung không được để trống.');
      if (input.attachmentIds?.length || input.postId) invalid('Tin chữ không kèm ảnh hay bài viết.');
    }
    if (input.kind === 'image') {
      const ids = input.attachmentIds ?? [];
      if (!ids.length) invalid('Cần ít nhất một ảnh.');
      if (new Set(ids).size !== ids.length) invalid('Ảnh bị lặp.');
      if (input.postId) invalid('Tin ảnh không kèm bài viết.');
    }
    if (input.kind === 'post_share') {
      if (!input.postId) invalid('Thiếu bài viết cần chia sẻ.');
      if (input.attachmentIds?.length) invalid('Tin chia sẻ bài không kèm ảnh.');
    }
    if (body.length > MESSAGING_LIMITS.bodyMax) invalid('Tin dài hơn 2.000 ký tự.');
    return { kind: input.kind, body };
  }

  private async assertReplyTarget(conversationId: string, seq: number, floor: number): Promise<void> {
    const target = await this.messages.findOne({ where: { conversationId, seq } });
    if (!target || target.seq <= floor) invalid('Tin được trả lời không còn trong hội thoại.');
  }

  private async assertPostVisible(postId: string): Promise<void> {
    const post = await this.posts.findOne({ where: { id: postId, status: 'visible' } });
    if (!post) invalid('Bài viết không còn hiển thị.');
  }

  private async view(row: MessageEntity, viewerId: string): Promise<MessageView> {
    const [view] = await this.presenter.messageViews([row], viewerId);
    return view as MessageView;
  }

  private async peerRead(conversationId: string, peerId: string): Promise<number> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('p.last_read_seq', 'seq')
      .from('conversation_participants', 'p')
      .where('p.conversation_id = :conversationId AND p.user_id = :peerId', { conversationId, peerId })
      .getRawOne<{ seq: string }>();
    return row ? Number(row.seq) : 0;
  }
}
