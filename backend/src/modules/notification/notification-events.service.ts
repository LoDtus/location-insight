import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { RealtimeRegistry } from '../auth/realtime.registry.js';
import type { NotificationView } from './notification.service.js';

const CHANNELS = {
  created: 'events:notification:created',
  changed: 'events:notification:changed',
} as const;

@Injectable()
export class NotificationEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventsService.name);
  private subscriber: Redis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly registry: RealtimeRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registry.onEvent('presence.visible', (context, payload) => {
      const visible = Boolean((payload as { visible?: boolean } | null)?.visible);
      const key = `notif:active:${context.userId}`;
      const client = this.redis.getClient();
      if (visible) void client.set(key, '1', 'EX', 45).catch(() => undefined);
      else void client.del(key).catch(() => undefined);
    });
    // Socket cuối của người dùng đóng (đăng xuất, đóng tab): bỏ cờ "đang xem" ngay để push không bị bỏ qua thêm 45 giây.
    this.registry.onDisconnect(async (context, remaining) => {
      if (remaining > 0) return;
      await this.redis.getClient().del(`notif:active:${context.userId}`).catch(() => undefined);
    });
    const subscriber = this.redis.getClient().duplicate();
    this.subscriber = subscriber;
    await subscriber.subscribe(...Object.values(CHANNELS));
    subscriber.on('message', (channel, raw) => this.dispatch(channel, raw));
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }

  async created(userId: string, item: NotificationView, updated: boolean, unread: number): Promise<void> {
    await this.publish(CHANNELS.created, userId, { item, updated, unread });
  }

  async changed(
    userId: string,
    body: { op: 'read' | 'unread' | 'read_all' | 'deleted' | 'updated'; ids?: string[]; upToId?: string; unread: number },
  ): Promise<void> {
    await this.publish(CHANNELS.changed, userId, body);
  }

  private async publish(channel: string, userId: string, body: Record<string, unknown>): Promise<void> {
    try {
      await this.redis.getClient().publish(
        channel,
        JSON.stringify({ v: 1, at: Date.now(), to: [userId], ...body }),
      );
    } catch (error) {
      this.logger.warn(`Không phát được ${channel}: ${error instanceof Error ? error.message : 'không rõ'}`);
    }
  }

  private dispatch(channel: string, raw: string): void {
    const event = channel === CHANNELS.created ? 'notification.created' : 'notification.changed';
    let payload: { to?: string[] } & Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as { to?: string[] };
    } catch {
      return;
    }
    const { to = [], v, at, ...rest } = payload;
    void v;
    void at;
    for (const userId of to) this.registry.emitToUser(userId, event, { type: event, ...rest });
  }
}
