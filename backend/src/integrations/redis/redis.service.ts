import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { serializeDates } from '../../shared/utils/iso-date.util.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    const password = config.get<string>('REDIS_PASSWORD');
    this.client = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: Number(config.getOrThrow<string>('REDIS_PORT')),
      password: password || undefined,
      maxRetriesPerRequest: 3,
      family: 4,
    });
  }

  async onModuleInit(): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        const pong = await this.client.ping();
        if (pong !== 'PONG') {
          throw new Error(`Redis trả về ${pong}`);
        }
        this.logger.log('Redis connected');
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Redis chưa sẵn sàng (${attempt}/10)`);
        await delay(3000);
      }
    }

    throw lastError;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    if (raw === null) return undefined;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const payload = JSON.stringify(serializeDates(value));
    if (ttlMs && ttlMs > 0) {
      await this.client.set(key, payload, 'PX', ttlMs);
      return;
    }

    await this.client.set(key, payload);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }

  getClient(): Redis {
    return this.client;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
