import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { AUTH_RATE_LIMITS, REDIS_KEYS, sha256 } from './auth.constants.js';
import { AuthRateLimitAction } from '../../common/decorators/access.decorator.js';

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consumeIp(action: AuthRateLimitAction, ip: string): Promise<void> {
    if (action === 'refresh') return;
    const rule = {
      google: { key: REDIS_KEYS.googleIp(ip), ...AUTH_RATE_LIMITS.googleIp },
      register: {
        key: REDIS_KEYS.registerIp(ip),
        ...AUTH_RATE_LIMITS.registerIp,
      },
      login: { key: REDIS_KEYS.loginIp(ip), ...AUTH_RATE_LIMITS.loginIp },
      sepay: { key: REDIS_KEYS.sepayIp(ip), ...AUTH_RATE_LIMITS.sepayIp },
      unsubscribe: {
        key: REDIS_KEYS.unsubscribeIp(ip),
        ...AUTH_RATE_LIMITS.unsubscribeIp,
      },
      reset: { key: REDIS_KEYS.resetIp(ip), ...AUTH_RATE_LIMITS.resetIp },
    }[action];
    await this.hit(rule.key, rule.limit, rule.windowSeconds);
    if (action === 'reset') {
      // Email bucket is applied by the caller when the body is known.
    }
  }

  async consumeResetEmail(email: string): Promise<void> {
    await this.hit(
      REDIS_KEYS.resetAccount(sha256(email.trim().toLowerCase())),
      AUTH_RATE_LIMITS.resetEmail.limit,
      AUTH_RATE_LIMITS.resetEmail.windowSeconds,
    );
  }

  async consumeRefresh(sessionId: string): Promise<void> {
    await this.hit(
      REDIS_KEYS.refreshSession(sessionId),
      AUTH_RATE_LIMITS.refreshSession.limit,
      AUTH_RATE_LIMITS.refreshSession.windowSeconds,
    );
  }

  async assertLoginAccount(email: string): Promise<void> {
    try {
      const data = await this.redis
        .getClient()
        .hgetall(REDIS_KEYS.loginAccount(sha256(email.trim().toLowerCase())));
      const until = Number(data.until ?? 0);
      if (until > Date.now()) {
        this.tooMany(Math.ceil((until - Date.now()) / 1000));
      }
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.unavailable();
    }
  }

  async noteLoginFailure(email: string): Promise<void> {
    const key = REDIS_KEYS.loginAccount(sha256(email.trim().toLowerCase()));
    try {
      const client = this.redis.getClient();
      const count = await client.hincrby(key, 'count', 1);
      await client.expire(key, AUTH_RATE_LIMITS.loginIp.windowSeconds);
      if (count > AUTH_RATE_LIMITS.loginFreeFailures) {
        const delay = Math.min(
          2 ** (count - AUTH_RATE_LIMITS.loginFreeFailures),
          AUTH_RATE_LIMITS.loginBackoffMaxSeconds,
        );
        await client.hset(key, 'until', String(Date.now() + delay * 1000));
      }
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.unavailable();
    }
  }

  private async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    try {
      const client = this.redis.getClient();
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, windowSeconds);
      if (count > limit) {
        const ttl = await client.ttl(key);
        this.tooMany(ttl > 0 ? ttl : windowSeconds);
      }
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.unavailable();
    }
  }

  private tooMany(retryAfter: number): never {
    throw new BusinessException(
      ErrorCode.TOO_MANY_REQUESTS,
      'Quá nhiều yêu cầu, vui lòng thử lại sau.',
      { retryAfter },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private unavailable(): never {
    throw new BusinessException(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Dịch vụ tạm thời không phản hồi.',
      null,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
