import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { RealtimeContext, RealtimeRegistry } from '../auth/realtime.registry.js';
import {
  MESSAGING_KEYS,
  PRESENCE_LAST_TTL_SECONDS,
  PRESENCE_ONLINE_TTL_SECONDS,
} from './messaging.constants.js';

export interface PresenceView {
  online: boolean;
  lastActiveAt: string | null;
}

@Injectable()
export class MessagingPresenceService implements OnModuleInit {
  constructor(
    private readonly redis: RedisService,
    private readonly registry: RealtimeRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.onConnect((context) => this.touch(context));
    this.registry.onPing((context) => this.touch(context));
    this.registry.onDisconnect(async (context, remaining) => {
      const client = this.redis.getClient();
      await client.set(
        MESSAGING_KEYS.last(context.userId),
        String(Date.now()),
        'EX',
        PRESENCE_LAST_TTL_SECONDS,
      );
      if (remaining <= 0) await client.del(MESSAGING_KEYS.online(context.userId));
    });
  }

  async read(userId: string): Promise<PresenceView> {
    try {
      const client = this.redis.getClient();
      const [online, last] = await client
        .pipeline()
        .exists(MESSAGING_KEYS.online(userId))
        .get(MESSAGING_KEYS.last(userId))
        .exec()
        .then((rows) => (rows ?? []).map(([, value]) => value));
      const at = last ? Number(last) : null;
      return {
        online: Boolean(online),
        lastActiveAt: at && Number.isFinite(at) ? new Date(at).toISOString() : null,
      };
    } catch {
      return { online: false, lastActiveAt: null };
    }
  }

  private async touch(context: RealtimeContext): Promise<void> {
    const client = this.redis.getClient();
    await client
      .pipeline()
      .set(MESSAGING_KEYS.online(context.userId), '1', 'EX', PRESENCE_ONLINE_TTL_SECONDS)
      .set(
        MESSAGING_KEYS.last(context.userId),
        String(Date.now()),
        'EX',
        PRESENCE_LAST_TTL_SECONDS,
      )
      .exec();
  }
}
