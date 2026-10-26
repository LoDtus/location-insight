import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { AuthConfig } from '../auth/auth.config.js';
import { QUOTA_RELEASE_LUA, QUOTA_RESERVE_LUA } from './quota.lua.js';
import { nextQuotaReset, quotaDayKey, quotaTtlSeconds } from './quota-time.js';

const HOLD_TTL_SECONDS = 10 * 60;

export interface QuotaReservation {
  ok: boolean;
  used: number;
  dayKey: string;
  resetAt: string;
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly authConfig: AuthConfig,
  ) {}

  applyBudget(limit: number | null): number | null {
    if (limit === null) return null;
    if (!this.authConfig.analysisBudgetGuard) return limit;
    return Math.max(1, Math.floor(limit / 2));
  }

  async reserve(
    userId: string,
    requestId: string,
    limit: number | null,
  ): Promise<QuotaReservation> {
    const dayKey = quotaDayKey();
    const resetAt = nextQuotaReset().toISOString();
    if (limit === null) {
      return { ok: true, used: 0, dayKey, resetAt };
    }

    try {
      const result = (await this.redis
        .getClient()
        .eval(
          QUOTA_RESERVE_LUA,
          2,
          this.quotaKey(userId, dayKey),
          this.holdKey(userId, requestId),
          String(limit),
          String(quotaTtlSeconds()),
          dayKey,
          String(HOLD_TTL_SECONDS),
        )) as [number, number];
      return {
        ok: Number(result[0]) === 1,
        used: Number(result[1]),
        dayKey,
        resetAt,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      throw new BusinessException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Không kiểm tra được hạn mức, vui lòng thử lại.',
        null,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async release(
    userId: string,
    requestId: string,
    dayKey: string,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.redis
          .getClient()
          .eval(
            QUOTA_RELEASE_LUA,
            2,
            this.holdKey(userId, requestId),
            this.quotaKey(userId, dayKey),
          );
        return;
      } catch (error) {
        this.logger.warn(`Hoàn lượt thất bại (${attempt}/3): ${String(error)}`);
      }
    }
  }

  async used(userId: string, dayKey = quotaDayKey()): Promise<number> {
    const value = await this.redis
      .getClient()
      .get(this.quotaKey(userId, dayKey));
    return Number(value ?? 0);
  }

  async reset(userId: string, dayKey = quotaDayKey()): Promise<void> {
    await this.redis.getClient().del(this.quotaKey(userId, dayKey));
  }

  private quotaKey(userId: string, dayKey: string): string {
    return `quota:analysis:${userId}:${dayKey}`;
  }

  private holdKey(userId: string, requestId: string): string {
    return `quota:hold:${userId}:${requestId}`;
  }
}
