import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { UserEntity, UserStatus } from '../auth/entities/user.entity.js';
import { cannotMessage, forbidden, notFound } from './messaging-errors.js';
import { isUuid } from './messaging-rules.js';
import { MESSAGING_KEYS } from './messaging.constants.js';
import { ConversationEntity } from './entities/conversation.entity.js';
import { ConversationParticipantEntity } from './entities/conversation-participant.entity.js';
import { MessagingPreferenceEntity } from './entities/messaging-preference.entity.js';
import { UserBlockEntity } from './entities/user-block.entity.js';

export interface Membership {
  conversation: ConversationEntity;
  me: ConversationParticipantEntity;
  peerId: string;
}

export interface Preferences {
  whoCanMessage: 'everyone' | 'nobody';
  showActivityStatus: boolean;
  sendReadReceipts: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  whoCanMessage: 'everyone',
  showActivityStatus: true,
  sendReadReceipts: true,
};

@Injectable()
export class MessagingAccessService {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
    @InjectRepository(ConversationParticipantEntity)
    private readonly participants: Repository<ConversationParticipantEntity>,
    @InjectRepository(MessagingPreferenceEntity)
    private readonly preferences: Repository<MessagingPreferenceEntity>,
    @InjectRepository(UserBlockEntity)
    private readonly blocks: Repository<UserBlockEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  /** Người không phải thành viên nhận 404, không phân biệt với "không tồn tại" (BR-07). */
  async membership(userId: string, conversationId: string): Promise<Membership> {
    if (!isUuid(conversationId)) notFound('Không tìm thấy hội thoại.');
    const me = await this.participants.findOne({
      where: { conversationId, userId, leftAt: IsNull() },
    });
    if (!me) notFound('Không tìm thấy hội thoại.');
    const conversation = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conversation || conversation.type !== 'direct') notFound('Không tìm thấy hội thoại.');
    const others = await this.participants.find({ where: { conversationId } });
    const peer = others.find((row) => row.userId !== userId);
    if (!peer) notFound('Không tìm thấy hội thoại.');
    return { conversation, me, peerId: peer.userId };
  }

  /** Danh sách thành viên còn tham gia, có bộ đệm Redis 10 phút. */
  async memberIds(conversationId: string): Promise<string[]> {
    const key = MESSAGING_KEYS.members(conversationId);
    try {
      const cached = await this.redis.getClient().smembers(key);
      if (cached.length) return cached;
    } catch {
      /* hỏi DB */
    }
    const rows = await this.participants.find({
      where: { conversationId, leftAt: IsNull() },
      select: { userId: true },
    });
    const ids = rows.map((row) => row.userId);
    if (ids.length) {
      try {
        const client = this.redis.getClient();
        await client.sadd(key, ...ids);
        await client.expire(key, 600);
      } catch {
        /* bỏ qua */
      }
    }
    return ids;
  }

  async forgetMembers(conversationId: string): Promise<void> {
    await this.redis.getClient().del(MESSAGING_KEYS.members(conversationId)).catch(() => undefined);
  }

  async preferencesOf(userId: string): Promise<Preferences> {
    const row = await this.preferences.findOne({ where: { userId } });
    return row
      ? {
          whoCanMessage: row.whoCanMessage,
          showActivityStatus: row.showActivityStatus,
          sendReadReceipts: row.sendReadReceipts,
        }
      : { ...DEFAULT_PREFERENCES };
  }

  async preferencesMany(userIds: string[]): Promise<Map<string, Preferences>> {
    const rows = userIds.length
      ? await this.preferences.find({ where: { userId: In(userIds) } })
      : [];
    const map = new Map<string, Preferences>();
    for (const id of userIds) map.set(id, { ...DEFAULT_PREFERENCES });
    for (const row of rows) {
      map.set(row.userId, {
        whoCanMessage: row.whoCanMessage,
        showActivityStatus: row.showActivityStatus,
        sendReadReceipts: row.sendReadReceipts,
      });
    }
    return map;
  }

  async blockedBetween(a: string, b: string): Promise<{ aBlocksB: boolean; bBlocksA: boolean }> {
    const rows = await this.blocks.find({
      where: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    });
    return {
      aBlocksB: rows.some((row) => row.blockerId === a),
      bBlocksA: rows.some((row) => row.blockerId === b),
    };
  }

  async isBlockedEither(a: string, b: string): Promise<boolean> {
    const result = await this.blockedBetween(a, b);
    return result.aBlocksB || result.bBlocksA;
  }

  /** Tài khoản gửi phải hoạt động, và (nếu bật cấu hình) đã xác minh email. */
  async assertSenderAllowed(userId: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) forbidden('Tài khoản không thể nhắn tin.');
    const required = this.config.get<string>('MESSAGING_REQUIRE_VERIFIED_EMAIL') === 'true';
    if (required && !user.emailVerifiedAt) {
      forbiddenWith('email_not_verified', 'Hãy xác minh email trước khi nhắn tin.');
    }
  }

  /** Chặn hai chiều, người kia bị khóa hoặc đã xóa: cùng một phản hồi. */
  async assertPeerReachable(userId: string, peerId: string): Promise<void> {
    const peer = await this.users.findOne({ where: { id: peerId }, withDeleted: true });
    if (!peer || peer.deletedAt || peer.status !== UserStatus.ACTIVE) cannotMessage();
    if (await this.isBlockedEither(userId, peerId)) cannotMessage();
  }
}

function forbiddenWith(code: string, message: string): never {
  throw new BusinessException(
    ErrorCode.PERMISSION_DENIED,
    message,
    { code },
    HttpStatus.FORBIDDEN,
  );
}
