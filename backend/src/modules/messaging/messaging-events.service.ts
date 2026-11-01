import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { RealtimeRegistry } from '../auth/realtime.registry.js';
import {
  EVENT_VERSION,
  MESSAGING_CHANNELS,
  SOCKET_EVENT_BY_CHANNEL,
} from './messaging.constants.js';

export interface EnvelopeBase {
  v: number;
  at: number;
  to: string[];
  [key: string]: unknown;
}

/**
 * Phát sự kiện: sau khi giao dịch DB commit, PUBLISH một lần; mọi instance backend
 * đều đăng ký và phát tới phòng `user:{id}` của socket mình giữ.
 * Pub/Sub chỉ giao tối đa một lần, nên client đồng bộ lại bằng REST theo seq.
 */
@Injectable()
export class MessagingEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingEventsService.name);
  private subscriber: Redis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly registry: RealtimeRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const subscriber = this.redis.getClient().duplicate();
    this.subscriber = subscriber;
    await subscriber.subscribe(...Object.values(MESSAGING_CHANNELS));
    subscriber.on('message', (channel, raw) => {
      this.dispatch(channel, raw);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }

  async publish(
    channel: (typeof MESSAGING_CHANNELS)[keyof typeof MESSAGING_CHANNELS],
    to: string[],
    body: Record<string, unknown>,
  ): Promise<void> {
    const recipients = [...new Set(to)];
    if (!recipients.length) return;
    const payload: EnvelopeBase = { v: EVENT_VERSION, at: Date.now(), to: recipients, ...body };
    try {
      await this.redis.getClient().publish(channel, JSON.stringify(payload));
    } catch (error) {
      this.logger.warn(
        `Không phát được ${channel}: ${error instanceof Error ? error.message : 'không rõ'}`,
      );
    }
  }

  private dispatch(channel: string, raw: string): void {
    const event = SOCKET_EVENT_BY_CHANNEL[channel];
    if (!event) return;
    let payload: EnvelopeBase;
    try {
      payload = JSON.parse(raw) as EnvelopeBase;
    } catch {
      return;
    }
    const { to, at, ...rest } = payload;
    void at;
    for (const userId of to) {
      this.registry.emitToUser(userId, event, {
        type: event,
        ...this.forUser(event, rest, userId),
      });
    }
  }

  /** Chỉ người gửi nhận `clientMsgId`; người khác nhận null (để tab gửi dedupe). */
  private forUser(
    event: string,
    body: Record<string, unknown>,
    userId: string,
  ): Record<string, unknown> {
    if (event !== 'message.created') return body;
    const message = body.message as { senderId?: string } | undefined;
    if (!message || message.senderId === userId) return body;
    return { ...body, message: { ...message, clientMsgId: null } };
  }
}
