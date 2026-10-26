import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { REDIS_KEYS } from './auth.constants.js';
import {
  AuthzCacheService,
  AuthzSnapshot,
} from '../rbac/authz-cache.service.js';
import { UserStatus } from './entities/user.entity.js';

export interface VerifiedSession {
  userId: string;
  sessionId: string;
  authTime: number;
  authz: AuthzSnapshot;
}

@Injectable()
export class SessionVerifierService {
  constructor(
    private readonly redis: RedisService,
    private readonly authz: AuthzCacheService,
  ) {}

  async verify(
    sessionId: string,
    userId: string,
    issuedAt: number,
  ): Promise<VerifiedSession> {
    let active: Array<string | null>;
    try {
      active = await this.redis
        .getClient()
        .hmget(REDIS_KEYS.sessionActive(sessionId), 'userId', 'authTime');
    } catch {
      throw this.unavailable();
    }

    if (!active[0] || active[0] !== userId) {
      const reason = await this.revokedReason(sessionId);
      throw new BusinessException(
        reason ? ErrorCode.SESSION_REVOKED : ErrorCode.SESSION_INACTIVE,
        reason ? 'Phiên đã bị thu hồi.' : 'Phiên chưa hoạt động.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }

    let authz = await this.authz.read(userId);
    if (!authz) authz = await this.authz.load(userId);

    if (issuedAt < authz.minIat) {
      throw new BusinessException(
        ErrorCode.SESSION_REVOKED,
        'Phiên đã bị thu hồi.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (
      authz.status === UserStatus.LOCKED ||
      authz.status === UserStatus.DELETED
    ) {
      throw new BusinessException(
        ErrorCode.SESSION_REVOKED,
        'Phiên đã bị thu hồi.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      userId,
      sessionId,
      authTime: Number(active[1] ?? 0),
      authz,
    };
  }

  private async revokedReason(sessionId: string): Promise<string | null> {
    try {
      return await this.redis
        .getClient()
        .get(REDIS_KEYS.sessionRevoked(sessionId));
    } catch {
      throw this.unavailable();
    }
  }

  private unavailable(): BusinessException {
    return new BusinessException(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Dịch vụ tạm thời không phản hồi.',
      null,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
