import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { AuthzCacheService } from '../rbac/authz-cache.service.js';
import { Plan, UserRole } from '../rbac/authorization.types.js';
import {
  AUTH_LIMITS,
  REDIS_CHANNELS,
  REDIS_KEYS,
  addDays,
  maskIp,
  randomToken,
  sha256,
} from './auth.constants.js';
import { AuthProvider } from './entities/auth-identity.entity.js';
import {
  AuthSessionEntity,
  SessionRevokeReason,
} from './entities/auth-session.entity.js';
import { AuthEventEntity } from './entities/auth-event.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { TokenService } from './token.service.js';

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  session: AuthSessionEntity;
  user: UserEntity;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    @InjectRepository(AuthEventEntity)
    private readonly events: Repository<AuthEventEntity>,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
    private readonly limits: AuthRateLimitService,
    @Inject(forwardRef(() => AuthzCacheService))
    private readonly authz: AuthzCacheService,
  ) {}

  async open(input: {
    user: UserEntity;
    method: AuthProvider;
    clientType: 'web' | 'native';
    deviceLabel: string;
    userAgent: string | null;
    ipAddress: string | null;
  }): Promise<IssuedSession> {
    await this.evictOverflow(input.user.id);
    const now = new Date();
    const refreshToken = randomToken();
    const session = this.sessions.create({
      userId: input.user.id,
      refreshHash: sha256(refreshToken),
      previousRefreshHash: null,
      rotatedAt: null,
      authMethod: input.method,
      authTime: now,
      clientType: input.clientType,
      deviceLabel: input.deviceLabel,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      lastIpAddress: input.ipAddress,
      countryCode: null,
      lastSeenAt: now,
      idleExpiresAt: addDays(now, AUTH_LIMITS.idleDays),
      absoluteExpiresAt: addDays(now, AUTH_LIMITS.absoluteDays),
      revokedAt: null,
      revokedReason: null,
    });
    await this.sessions.save(session);
    input.user.lastLoginAt = now;
    await this.dataSource.getRepository(UserEntity).save(input.user);

    try {
      await this.remember(session);
      await this.authz.load(input.user.id);
    } catch (error) {
      await this.sessions.delete({ id: session.id });
      throw error instanceof BusinessException
        ? error
        : this.unavailable(error);
    }

    await this.record(
      'login_success',
      input.user.id,
      session.id,
      input.ipAddress,
      input.userAgent,
    );
    const accessToken = await this.tokens.signAccessToken(
      input.user.id,
      session.id,
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: AUTH_LIMITS.accessTtlSeconds,
      session,
      user: input.user,
    };
  }

  async rotate(
    refreshToken: string,
    ipAddress: string | null,
  ): Promise<IssuedSession> {
    const hash = sha256(refreshToken);
    const outcome = await this.dataSource.transaction(async (manager) => {
      const session = await manager
        .createQueryBuilder(AuthSessionEntity, 'session')
        .setLock('pessimistic_write')
        .where(
          'session.refreshHash = :hash OR session.previousRefreshHash = :hash',
          { hash },
        )
        .getOne();

      if (!session || session.revokedAt) return { kind: 'invalid' as const };
      await this.limits.consumeRefresh(session.id);

      const now = new Date();
      if (session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
        session.revokedAt = now;
        session.revokedReason = SessionRevokeReason.EXPIRED;
        await manager.save(session);
        return { kind: 'expired' as const, session };
      }

      const matchesCurrent = session.refreshHash.trim() === hash;
      const withinGrace =
        session.previousRefreshHash?.trim() === hash &&
        session.rotatedAt !== null &&
        now.getTime() - session.rotatedAt.getTime() <=
          AUTH_LIMITS.refreshGraceSeconds * 1000;

      if (!matchesCurrent && !withinGrace) {
        session.revokedAt = now;
        session.revokedReason = SessionRevokeReason.REUSE_DETECTED;
        await manager.save(session);
        return { kind: 'reuse' as const, session };
      }

      const nextRefresh = randomToken();
      session.previousRefreshHash = session.refreshHash;
      session.refreshHash = sha256(nextRefresh);
      session.rotatedAt = now;
      session.lastSeenAt = now;
      session.lastIpAddress = ipAddress;
      session.idleExpiresAt = new Date(
        Math.min(
          addDays(now, AUTH_LIMITS.idleDays).getTime(),
          session.absoluteExpiresAt.getTime(),
        ),
      );
      await manager.save(session);
      const user = await manager.findOneByOrFail(UserEntity, {
        id: session.userId,
      });
      return { kind: 'ok' as const, session, user, refreshToken: nextRefresh };
    });

    if (outcome.kind === 'invalid') throw this.refreshInvalid();
    if (outcome.kind === 'expired') {
      await this.markRevoked(outcome.session, SessionRevokeReason.EXPIRED);
      throw this.refreshInvalid();
    }
    if (outcome.kind === 'reuse') {
      await this.markRevoked(
        outcome.session,
        SessionRevokeReason.REUSE_DETECTED,
      );
      await this.record(
        'refresh_reuse_detected',
        outcome.session.userId,
        outcome.session.id,
        ipAddress,
        null,
      );
      throw new BusinessException(
        ErrorCode.SESSION_REVOKED,
        'Phiên đã bị thu hồi.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.remember(outcome.session);
    const accessToken = await this.tokens.signAccessToken(
      outcome.user.id,
      outcome.session.id,
    );
    return {
      accessToken,
      refreshToken: outcome.refreshToken,
      expiresIn: AUTH_LIMITS.accessTtlSeconds,
      session: outcome.session,
      user: outcome.user,
    };
  }

  async revoke(
    session: AuthSessionEntity,
    reason: SessionRevokeReason,
    ipAddress: string | null,
  ): Promise<void> {
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      session.revokedReason = reason;
      await this.sessions.save(session);
      await this.record(
        'session_revoked',
        session.userId,
        session.id,
        ipAddress,
        null,
        {
          reason,
        },
      );
    }
    await this.markRevoked(session, reason);
  }

  async revokeAll(
    userId: string,
    reason: SessionRevokeReason,
    exceptId?: string,
  ): Promise<number> {
    const rows = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
    });
    let revoked = 0;
    for (const session of rows) {
      if (exceptId && session.id === exceptId) continue;
      await this.revoke(session, reason, null);
      revoked += 1;
    }
    return revoked;
  }

  async list(userId: string, currentId: string | null) {
    const rows = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastSeenAt: 'DESC' },
    });
    return rows.map((session) => this.toItem(session, currentId));
  }

  toItem(session: AuthSessionEntity, currentId: string | null) {
    return {
      sessionId: session.id,
      deviceLabel: session.deviceLabel,
      clientType: session.clientType,
      authMethod: session.authMethod,
      ipAddress: maskIp(session.lastIpAddress || session.ipAddress),
      city: null,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      isCurrent: session.id === currentId,
    };
  }

  async summary(user: UserEntity) {
    const snapshot = await this.authz.load(user.id);
    const plan =
      snapshot.role === UserRole.ADMIN
        ? Plan.VALUED
        : snapshot.planUntil > Date.now()
          ? snapshot.plan
          : Plan.FREE;
    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      plan,
    };
  }

  async record(
    type: string,
    userId: string | null,
    sessionId: string | null,
    ipAddress: string | null,
    userAgent: string | null,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.events.save(
      this.events.create({
        userId,
        sessionId,
        type,
        ipAddress,
        userAgent,
        meta: meta ?? null,
      }),
    );
  }

  async findOwned(
    userId: string,
    sessionId: string,
  ): Promise<AuthSessionEntity> {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId, revokedAt: IsNull() },
    });
    if (!session) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy phiên.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    return session;
  }

  async rename(userId: string, sessionId: string, deviceLabel: string) {
    const session = await this.findOwned(userId, sessionId);
    session.deviceLabel = deviceLabel.trim().slice(0, 80);
    await this.sessions.save(session);
    return this.toItem(session, sessionId);
  }

  async markReauthenticated(sessionId: string): Promise<void> {
    const session = await this.sessions.findOneBy({ id: sessionId });
    if (!session || session.revokedAt) return;
    session.authTime = new Date();
    await this.sessions.save(session);
    await this.redis.getClient().hset(REDIS_KEYS.sessionActive(session.id), {
      authTime: String(session.authTime.getTime()),
    });
    await this.record('reauth_success', session.userId, session.id, null, null);
  }

  async reconcile(): Promise<void> {
    const since = new Date(
      Date.now() - AUTH_LIMITS.sessionActiveTtlSeconds * 1000,
    );
    const rows = await this.sessions
      .createQueryBuilder('session')
      .where('session.revokedAt IS NOT NULL')
      .andWhere('session.revokedAt > :since', { since })
      .getMany();
    if (!rows.length) return;
    const pipeline = this.redis.getClient().pipeline();
    for (const session of rows) {
      pipeline.del(REDIS_KEYS.sessionActive(session.id));
    }
    await pipeline.exec();
  }

  async cleanup(): Promise<void> {
    const sessionCutoff = addDays(
      new Date(),
      -AUTH_LIMITS.revokedSessionRetentionDays,
    );
    const eventCutoff = new Date();
    eventCutoff.setUTCMonth(
      eventCutoff.getUTCMonth() - AUTH_LIMITS.eventRetentionMonths,
    );

    await this.sessions
      .createQueryBuilder()
      .delete()
      .where('revoked_at IS NOT NULL AND revoked_at < :cutoff', {
        cutoff: sessionCutoff,
      })
      .orWhere('absolute_expires_at < :cutoff', { cutoff: sessionCutoff })
      .execute();
    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from('auth_one_time_tokens')
      .where('expires_at < NOW()')
      .execute();
    await this.events
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff: eventCutoff })
      .execute();
  }

  private async evictOverflow(userId: string): Promise<void> {
    const active = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastSeenAt: 'ASC' },
    });
    const overflow = active.length - AUTH_LIMITS.maxSessions + 1;
    if (overflow <= 0) return;
    for (const session of active.slice(0, overflow)) {
      await this.revoke(session, SessionRevokeReason.EVICTED, null);
    }
  }

  private async remember(session: AuthSessionEntity): Promise<void> {
    const client = this.redis.getClient();
    await client.hset(REDIS_KEYS.sessionActive(session.id), {
      userId: session.userId,
      authTime: String(session.authTime.getTime()),
      clientType: session.clientType,
      createdAt: String(session.createdAt?.getTime?.() ?? Date.now()),
    });
    await client.expire(
      REDIS_KEYS.sessionActive(session.id),
      AUTH_LIMITS.sessionActiveTtlSeconds,
    );
  }

  private async markRevoked(
    session: AuthSessionEntity,
    reason: SessionRevokeReason,
  ): Promise<void> {
    try {
      const client = this.redis.getClient();
      await client.del(REDIS_KEYS.sessionActive(session.id));
      await client.set(
        REDIS_KEYS.sessionRevoked(session.id),
        reason,
        'EX',
        AUTH_LIMITS.sessionActiveTtlSeconds,
      );
      await client.publish(
        REDIS_CHANNELS.sessionRevoked,
        JSON.stringify({
          sid: session.id,
          userId: session.userId,
          reason,
          at: Date.now(),
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Thu hồi Redis chưa xong, job đối soát sẽ dọn: ${String(error)}`,
      );
    }
  }

  private refreshInvalid(): BusinessException {
    return new BusinessException(
      ErrorCode.REFRESH_INVALID,
      'Phiên đăng nhập không còn hợp lệ.',
      null,
      HttpStatus.UNAUTHORIZED,
    );
  }

  private unavailable(error: unknown): BusinessException {
    this.logger.error(String(error));
    return new BusinessException(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Dịch vụ tạm thời không phản hồi.',
      null,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
