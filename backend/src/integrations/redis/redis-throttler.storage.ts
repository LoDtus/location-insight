import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    const password = config.get<string>('REDIS_PASSWORD');
    this.client = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: Number(config.getOrThrow<string>('REDIS_PORT')),
      password: password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      family: 4,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ReturnType<ThrottlerStorage['increment']> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:${throttlerName}:block:${key}`;
    const blockedFor = await this.client.pttl(blockKey);

    if (blockedFor > 0) {
      const timeToExpire = await this.positiveTtl(hitKey, ttl);
      return {
        totalHits: limit + 1,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: blockedFor,
      };
    }

    const totalHits = await this.client.incr(hitKey);
    if (totalHits === 1) {
      await this.client.pexpire(hitKey, ttl);
    }

    const timeToExpire = await this.positiveTtl(hitKey, ttl);
    if (totalHits > limit) {
      const blockMs = blockDuration > 0 ? blockDuration : ttl;
      await this.client.set(blockKey, '1', 'PX', blockMs);
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: blockMs,
      };
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  private async positiveTtl(key: string, fallback: number): Promise<number> {
    const ttl = await this.client.pttl(key);
    return ttl > 0 ? ttl : fallback;
  }
}
