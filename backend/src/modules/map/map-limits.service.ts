import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapConfig } from './map.config.js';
import {
  MAP_BREAKER,
  MAP_REDIS_KEYS,
  MAP_USER_LIMITS,
  type MapApi,
} from './map.constants.js';

const DAY_SECONDS = 24 * 60 * 60;
const QUOTA_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function vnDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

@Injectable()
export class MapLimitsService {
  private readonly logger = new Logger(MapLimitsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: MapConfig,
  ) {}

  /** Giới hạn theo người dùng. Redis lỗi → 503 (không bỏ giới hạn, như 003-auth). */
  async consumeUser(api: MapApi | 'config', userId: string): Promise<void> {
    const rule = MAP_USER_LIMITS[api];
    try {
      const client = this.redis.getClient();
      const key = MAP_REDIS_KEYS.userLimit(api, userId);
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, rule.windowSeconds);
      if (count > rule.limit) {
        const ttl = await client.ttl(key);
        throw new BusinessException(
          ErrorCode.TOO_MANY_REQUESTS,
          'Bạn thao tác hơi nhanh, vui lòng thử lại sau ít giây.',
          { retryAfter: ttl > 0 ? ttl : rule.windowSeconds },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Redis lỗi khi kiểm tra giới hạn bản đồ');
      throw this.unavailable('Dịch vụ tạm thời không phản hồi.');
    }
  }

  /** Mỗi lần gọi upstream trừ vào ngân sách ngày (cache hit không tính). */
  async consumeBudget(): Promise<void> {
    const budget = this.config.dailyBudget;
    if (budget === 0) return;
    try {
      const client = this.redis.getClient();
      const key = MAP_REDIS_KEYS.budget(vnDay());
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, 2 * DAY_SECONDS);
      if (count > budget) {
        throw this.unavailable(
          'Dịch vụ bản đồ đã đạt giới hạn trong ngày, vui lòng quay lại vào ngày mai.',
        );
      }
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Redis lỗi khi kiểm tra ngân sách bản đồ');
      throw this.unavailable('Dịch vụ tạm thời không phản hồi.');
    }
  }

  async assertBreakerClosed(): Promise<void> {
    try {
      if (await this.redis.getClient().exists(MAP_REDIS_KEYS.breakerOpen)) {
        throw this.unavailable('Dịch vụ bản đồ đang gián đoạn, vui lòng thử lại sau ít phút.');
      }
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      // Redis lỗi: cầu dao không quyết định được; để giới hạn/ngân sách quyết định.
      this.logger.warn('Redis lỗi khi đọc cầu dao bản đồ');
    }
  }

  async recordSuccess(): Promise<void> {
    try {
      await this.redis.getClient().del(MAP_REDIS_KEYS.breakerFails);
    } catch {
      /* không ảnh hưởng nghiệp vụ */
    }
  }

  async recordFailure(): Promise<void> {
    try {
      const client = this.redis.getClient();
      const count = await client.incr(MAP_REDIS_KEYS.breakerFails);
      if (count === 1) await client.expire(MAP_REDIS_KEYS.breakerFails, MAP_BREAKER.openSeconds);
      if (count >= MAP_BREAKER.failures) {
        await client.set(MAP_REDIS_KEYS.breakerOpen, '1', 'EX', MAP_BREAKER.openSeconds);
        await client.del(MAP_REDIS_KEYS.breakerFails);
        this.logger.error(`Cầu dao Vietmap mở ${MAP_BREAKER.openSeconds}s sau ${count} lỗi liên tiếp`);
      }
    } catch {
      /* không ảnh hưởng nghiệp vụ */
    }
  }

  async countUsage(kind: 'usage' | 'hits', api: MapApi): Promise<void> {
    try {
      const client = this.redis.getClient();
      const key = MAP_REDIS_KEYS[kind](vnDay(), api);
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, 8 * DAY_SECONDS);
    } catch {
      /* thống kê không được làm hỏng request */
    }
  }

  async readUsage(
    api: MapApi,
  ): Promise<{ upstream: number; hits: number }> {
    const client = this.redis.getClient();
    const day = vnDay();
    const [upstream, hits] = await client.mget(
      MAP_REDIS_KEYS.usage(day, api),
      MAP_REDIS_KEYS.hits(day, api),
    );
    return { upstream: Number(upstream ?? 0), hits: Number(hits ?? 0) };
  }

  async readBudgetUsed(): Promise<number> {
    const value = await this.redis.getClient().get(MAP_REDIS_KEYS.budget(vnDay()));
    return Number(value ?? 0);
  }

  private unavailable(message: string): BusinessException {
    return new BusinessException(
      ErrorCode.SERVICE_UNAVAILABLE,
      message,
      null,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
