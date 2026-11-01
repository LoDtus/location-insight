import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { ListConversationsQueryDto } from './dto/messaging.dto.js';
import { FollowService } from '../follow/follow.service.js';
import { MessagingAccessService } from './messaging-access.service.js';
import { rowsOf } from './messaging-db.js';
import { conflict, cannotMessage, invalid } from './messaging-errors.js';
import { MessagingEventsService } from './messaging-events.service.js';
import { MessagingPresenterService } from './messaging-presenter.service.js';
import { MessagingRateLimitService } from './messaging-rate-limit.service.js';
import { directKey, escapeLike, readCursor, writeCursor } from './messaging-rules.js';
import { MESSAGING_CHANNELS, MESSAGING_KEYS, MESSAGING_LIMITS } from './messaging.constants.js';
import { ConversationEntity } from './entities/conversation.entity.js';
import { ConversationParticipantEntity } from './entities/conversation-participant.entity.js';

@Injectable()
export class MessagingConversationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly access: MessagingAccessService,
    private readonly presenter: MessagingPresenterService,
    private readonly events: MessagingEventsService,
    private readonly rate: MessagingRateLimitService,
    private readonly follows: FollowService,
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
    @InjectRepository(ConversationParticipantEntity)
    private readonly participants: Repository<ConversationParticipantEntity>,
  ) {}

  async list(userId: string, query: ListConversationsQueryDto) {
    const limit = query.limit ?? MESSAGING_LIMITS.inboxPage;
    const folder = query.folder ?? 'inbox';
    const qb = this.participants
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.conversation', 'c')
      .where('p.userId = :me', { me: userId })
      .andWhere('p.leftAt IS NULL')
      .andWhere('p.hiddenAt IS NULL')
      .andWhere('c.lastSeq > 0')
      .orderBy('p.lastActivityAt', 'DESC')
      .addOrderBy('p.conversationId', 'DESC')
      .take(limit + 1);
    this.applyFolder(qb, folder, userId);
    if (query.q) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM conversation_participants o INNER JOIN users u ON u.id = o.user_id
                 WHERE o.conversation_id = c.id AND o.user_id <> :me
                 AND lower(u.display_name) LIKE lower(:q) ESCAPE '\\')`,
        { q: `${escapeLike(query.q)}%` },
      );
    }
    const point = readCursor(query.cursor, 2);
    if (point) {
      qb.andWhere(
        '(p.lastActivityAt < :at OR (p.lastActivityAt = :at AND p.conversationId < :cid))',
        { at: new Date(point[0] as string), cid: point[1] },
      );
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const last = slice.at(-1);
    const items = await this.presenter.summaries(
      slice.map((row) => ({ conversation: row.conversation, me: row })),
      userId,
    );
    return {
      items,
      nextCursor:
        hasMore && last ? writeCursor([last.lastActivityAt.toISOString(), last.conversationId]) : null,
    };
  }

  async get(userId: string, conversationId: string) {
    const m = await this.access.membership(userId, conversationId);
    return this.presenter.detail(m.conversation, m.me, m.peerId, userId);
  }

  async findOrCreate(userId: string, peerId: string) {
    if (peerId === userId) invalid('Không thể nhắn tin cho chính mình.');
    await this.access.assertSenderAllowed(userId);
    await this.access.assertPeerReachable(userId, peerId);
    const key = directKey(userId, peerId);
    const existing = await this.conversations.findOne({ where: { directKey: key } });
    if (existing) {
      await this.participants.update(
        { conversationId: existing.id, userId },
        { hiddenAt: null },
      );
      return { view: await this.get(userId, existing.id), created: false };
    }
    const theirs = await this.access.preferencesOf(peerId);
    if (theirs.whoCanMessage === 'nobody') cannotMessage();
    await this.assertCanOpenMore(userId);
    await this.rate.consume('newConversation', `user_${userId}`);

    // Người nhận đang theo dõi người gửi: bỏ bước Yêu cầu (011-follow, BR-08).
    const initialState = (await this.follows.isFollowing(peerId, userId)) ? 'active' : 'pending';
    const id = uuidv7();
    const created = await this.dataSource.transaction(async (manager) => {
      const raw: unknown = await manager.query(
        `INSERT INTO conversations (id, type, state, direct_key, initiator_id, last_seq, last_message_preview, created_at, updated_at)
         VALUES ($1, 'direct', $4, $2, $3, 0, '', now(), now())
         ON CONFLICT (direct_key) DO NOTHING RETURNING id`,
        [id, key, userId, initialState],
      );
      const inserted = rowsOf(raw).length > 0;
      if (!inserted) return false;
      const now = new Date();
      await manager.insert(ConversationParticipantEntity, [
        { conversationId: id, userId, role: 'member', lastActivityAt: now },
        { conversationId: id, userId: peerId, role: 'member', lastActivityAt: now },
      ]);
      return true;
    });
    if (!created) {
      const winner = await this.conversations.findOneOrFail({ where: { directKey: key } });
      return { view: await this.get(userId, winner.id), created: false };
    }
    return { view: await this.get(userId, id), created: true };
  }

  async accept(userId: string, conversationId: string) {
    const m = await this.access.membership(userId, conversationId);
    const { conversation } = m;
    if (conversation.state === 'active' || conversation.initiatorId === userId) {
      conflict('Không thể chấp nhận hội thoại này.');
    }
    await this.access.assertPeerReachable(userId, m.peerId);
    await this.conversations.update({ id: conversationId }, { state: 'active' });
    await this.participants.update({ conversationId, userId }, { hiddenAt: null });
    await this.invalidateUnread([userId, m.peerId]);
    await this.events.publish(MESSAGING_CHANNELS.conversationUpdated, [userId, m.peerId], {
      conversationId,
      reason: 'accepted',
    });
    await this.events.publish(MESSAGING_CHANNELS.unread, [userId, m.peerId], {});
    return this.get(userId, conversationId);
  }

  async decline(userId: string, conversationId: string): Promise<void> {
    const m = await this.access.membership(userId, conversationId);
    if (m.conversation.state !== 'pending' || m.conversation.initiatorId === userId) {
      conflict('Không thể từ chối hội thoại này.');
    }
    await this.conversations.update({ id: conversationId }, { state: 'declined' });
    await this.participants.update({ conversationId, userId }, { hiddenAt: new Date() });
    await this.invalidateUnread([userId]);
    await this.events.publish(MESSAGING_CHANNELS.conversationUpdated, [userId], {
      conversationId,
      reason: 'declined',
    });
    await this.events.publish(MESSAGING_CHANNELS.unread, [userId], {});
  }

  async markRead(userId: string, conversationId: string, seq: number): Promise<void> {
    const m = await this.access.membership(userId, conversationId);
    await this.rate.consume('read', `user_${userId}`);
    const target = Math.min(seq, m.conversation.lastSeq);
    if (target <= m.me.lastReadSeq) return;
    await this.participants
      .createQueryBuilder()
      .update(ConversationParticipantEntity)
      .set({ lastReadSeq: () => `GREATEST(last_read_seq, ${Math.floor(target)})` })
      .where('conversation_id = :conversationId AND user_id = :userId', { conversationId, userId })
      .execute();
    await this.invalidateUnread([userId]);
    const prefs = await this.access.preferencesMany([userId, m.peerId]);
    const receipts = Boolean(
      prefs.get(userId)?.sendReadReceipts && prefs.get(m.peerId)?.sendReadReceipts,
    );
    await this.events.publish(
      MESSAGING_CHANNELS.conversationRead,
      receipts ? [userId, m.peerId] : [userId],
      { conversationId, userId, lastReadSeq: target },
    );
    await this.events.publish(MESSAGING_CHANNELS.unread, [userId], {});
  }

  async mute(userId: string, conversationId: string, until: string | null): Promise<void> {
    await this.access.membership(userId, conversationId);
    const value = until ? new Date(until) : null;
    if (value && Number.isNaN(value.getTime())) invalid('Thời điểm không hợp lệ.');
    await this.participants.update({ conversationId, userId }, { mutedUntil: value });
    await this.invalidateUnread([userId]);
    await this.events.publish(MESSAGING_CHANNELS.unread, [userId], {});
  }

  async deleteForMe(userId: string, conversationId: string): Promise<void> {
    const m = await this.access.membership(userId, conversationId);
    await this.participants.update(
      { conversationId, userId },
      {
        clearedBeforeSeq: m.conversation.lastSeq,
        lastReadSeq: m.conversation.lastSeq,
        hiddenAt: new Date(),
      },
    );
    await this.invalidateUnread([userId]);
    await this.events.publish(MESSAGING_CHANNELS.conversationUpdated, [userId], {
      conversationId,
      reason: 'deleted_by_me',
    });
    await this.events.publish(MESSAGING_CHANNELS.unread, [userId], {});
  }

  async unreadCount(userId: string): Promise<{ inbox: number; requests: number }> {
    const key = MESSAGING_KEYS.unread(userId);
    try {
      const cached = await this.redis.getClient().hgetall(key);
      if (cached.inbox !== undefined && cached.requests !== undefined) {
        return { inbox: Number(cached.inbox), requests: Number(cached.requests) };
      }
    } catch {
      /* tính lại từ DB */
    }
    const [inbox, requests] = await Promise.all([
      this.countUnread(userId, 'inbox'),
      this.countUnread(userId, 'requests'),
    ]);
    const result = {
      inbox: Math.min(inbox, MESSAGING_LIMITS.unreadCap),
      requests: Math.min(requests, MESSAGING_LIMITS.unreadCap),
    };
    try {
      const client = this.redis.getClient();
      await client.hset(key, { inbox: result.inbox, requests: result.requests });
      await client.expire(key, 300);
    } catch {
      /* không có bộ đệm vẫn đúng */
    }
    return result;
  }

  async invalidateUnread(userIds: string[]): Promise<void> {
    if (!userIds.length) return;
    try {
      await this.redis.getClient().del(...userIds.map((id) => MESSAGING_KEYS.unread(id)));
    } catch {
      /* hết hạn sau 5 phút */
    }
  }

  private async countUnread(userId: string, folder: 'inbox' | 'requests'): Promise<number> {
    const qb = this.participants
      .createQueryBuilder('p')
      .innerJoin('p.conversation', 'c')
      .where('p.userId = :me', { me: userId })
      .andWhere('p.leftAt IS NULL')
      .andWhere('p.hiddenAt IS NULL')
      .andWhere('c.lastSeq > p.lastReadSeq');
    this.applyFolder(qb, folder, userId);
    if (folder === 'inbox') {
      qb.andWhere('(p.mutedUntil IS NULL OR p.mutedUntil <= now())');
    }
    return qb.getCount();
  }

  private applyFolder(
    qb: ReturnType<Repository<ConversationParticipantEntity>['createQueryBuilder']>,
    folder: 'inbox' | 'requests',
    userId: string,
  ): void {
    if (folder === 'requests') {
      const since = new Date(Date.now() - MESSAGING_LIMITS.requestVisibleDays * 86_400_000);
      qb.andWhere("c.state = 'pending' AND c.initiatorId <> :me", { me: userId });
      qb.andWhere('c.lastMessageAt > :since', { since });
      return;
    }
    qb.andWhere("(c.state = 'active' OR c.initiatorId = :me)", { me: userId });
  }

  private async assertCanOpenMore(userId: string): Promise<void> {
    const pending = await this.conversations.count({
      where: { initiatorId: userId, state: 'pending' },
    });
    if (pending >= MESSAGING_LIMITS.pendingMax) {
      throw new BusinessException(
        ErrorCode.LIMIT_REACHED,
        'Bạn đang có quá nhiều yêu cầu nhắn chưa được trả lời.',
        null,
        HttpStatus.CONFLICT,
      );
    }
  }
}
