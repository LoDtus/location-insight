import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { RealtimeContext, RealtimeRegistry } from '../auth/realtime.registry.js';
import { MessagingAccessService } from './messaging-access.service.js';
import { MessagingEventsService } from './messaging-events.service.js';
import { isUuid } from './messaging-rules.js';
import { MESSAGING_CHANNELS } from './messaging.constants.js';
import { ConversationEntity } from './entities/conversation.entity.js';

/** Tín hiệu tạm từ client (đang gõ). Mọi điều kiện sai đều bỏ im lặng để không lộ hội thoại (I2). */
@Injectable()
export class MessagingRealtimeService implements OnModuleInit {
  constructor(
    private readonly registry: RealtimeRegistry,
    private readonly redis: RedisService,
    private readonly access: MessagingAccessService,
    private readonly events: MessagingEventsService,
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
  ) {}

  onModuleInit(): void {
    this.registry.onEvent('typing', (context, payload) => this.typing(context, payload));
  }

  private async typing(context: RealtimeContext, payload: unknown): Promise<void> {
    const body = payload as { conversationId?: unknown; active?: unknown } | null;
    if (!body || typeof body.conversationId !== 'string' || typeof body.active !== 'boolean') return;
    const { conversationId, active } = body;
    if (!isUuid(conversationId)) return;
    if (active) {
      const slot = await this.redis
        .getClient()
        .set(`ratelimit:msg:typing:conv_${conversationId}:user_${context.userId}`, '1', 'EX', 2, 'NX')
        .catch(() => null);
      if (slot !== 'OK') return;
    }
    const members = await this.access.memberIds(conversationId);
    if (!members.includes(context.userId)) return;
    const conversation = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conversation || conversation.state !== 'active') return;
    const peers = members.filter((id) => id !== context.userId);
    for (const peer of peers) {
      if (await this.access.isBlockedEither(context.userId, peer)) return;
    }
    await this.events.publish(MESSAGING_CHANNELS.typing, peers, {
      conversationId,
      userId: context.userId,
      active,
    });
  }
}
