import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { IsNull, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { UserRole } from '../rbac/authorization.types.js';
import {
  AUTH_LIMITS,
  REDIS_KEYS,
  randomToken,
  safeRedirect,
} from './auth.constants.js';
import { AuthConfig } from './auth.config.js';
import {
  AuthIdentityEntity,
  AuthProvider,
} from './entities/auth-identity.entity.js';
import { AuthSessionEntity } from './entities/auth-session.entity.js';
import { UserEntity, UserStatus } from './entities/user.entity.js';
import { IssuedSession, SessionService } from './session.service.js';

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

interface OAuthState {
  codeVerifier: string;
  nonce: string;
  redirectTo: string;
  reauthUserId: string | null;
}

export type GoogleCallbackResult =
  | { ok: true; issued: IssuedSession | null; redirectTo: string }
  | { ok: false; error: string; redirectTo: string };

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly authConfig: AuthConfig,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthIdentityEntity)
    private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessionRows: Repository<AuthSessionEntity>,
  ) {}

  async start(
    redirectTo: string | undefined,
    reauthUserId: string | null,
  ): Promise<string> {
    if (!this.authConfig.googleConfigured) {
      throw new BusinessException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Đăng nhập Google chưa được cấu hình.',
        null,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const state = randomToken(24);
    const codeVerifier = randomToken(32);
    const nonce = randomToken(16);
    const payload: OAuthState = {
      codeVerifier,
      nonce,
      redirectTo: safeRedirect(redirectTo, this.authConfig.allowedRedirects),
      reauthUserId,
    };
    await this.redis
      .getClient()
      .set(
        REDIS_KEYS.oauthState(state),
        JSON.stringify(payload),
        'EX',
        AUTH_LIMITS.oauthStateTtlSeconds,
      );

    const challenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.authConfig.googleClientId);
    url.searchParams.set('redirect_uri', this.authConfig.googleRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (reauthUserId) url.searchParams.set('prompt', 'login');
    return url.toString();
  }

  async callback(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    meta: { userAgent: string | null; ipAddress: string | null },
  ): Promise<GoogleCallbackResult> {
    const fallback = '/app/map';
    if (error) {
      return { ok: false, error: 'oauth_denied', redirectTo: fallback };
    }
    if (!code || !state) {
      return { ok: false, error: 'oauth_state', redirectTo: fallback };
    }

    const raw = await this.redis
      .getClient()
      .getdel(REDIS_KEYS.oauthState(state));
    if (!raw) return { ok: false, error: 'oauth_state', redirectTo: fallback };
    let saved: OAuthState;
    try {
      saved = JSON.parse(raw) as OAuthState;
    } catch {
      return { ok: false, error: 'oauth_state', redirectTo: fallback };
    }

    let idToken: string;
    try {
      idToken = await this.exchange(code, saved.codeVerifier);
    } catch {
      return { ok: false, error: 'oauth_state', redirectTo: saved.redirectTo };
    }

    const claims = await this.verifyIdToken(idToken, saved.nonce);
    if (!claims) {
      return { ok: false, error: 'oauth_state', redirectTo: saved.redirectTo };
    }
    if (!claims.emailVerified) {
      return {
        ok: false,
        error: 'email_unverified',
        redirectTo: saved.redirectTo,
      };
    }

    if (saved.reauthUserId) {
      const identity = await this.identities.findOne({
        where: { provider: AuthProvider.GOOGLE, providerUserId: claims.sub },
      });
      if (!identity || identity.userId !== saved.reauthUserId) {
        return {
          ok: false,
          error: 'oauth_denied',
          redirectTo: saved.redirectTo,
        };
      }
      await this.touchAuthTime(saved.reauthUserId);
      return { ok: true, issued: null, redirectTo: saved.redirectTo };
    }

    const linked = await this.resolveUser(claims);
    if (!linked.ok) {
      return { ok: false, error: linked.error, redirectTo: saved.redirectTo };
    }
    if (linked.user.status === UserStatus.LOCKED) {
      return {
        ok: false,
        error: 'account_locked',
        redirectTo: saved.redirectTo,
      };
    }

    const issued = await this.sessions.open({
      user: linked.user,
      method: AuthProvider.GOOGLE,
      clientType: 'web',
      deviceLabel: meta.userAgent ? meta.userAgent.slice(0, 80) : 'Google',
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });
    return { ok: true, issued, redirectTo: saved.redirectTo };
  }

  private async exchange(code: string, codeVerifier: string): Promise<string> {
    const body = new URLSearchParams({
      code,
      client_id: this.authConfig.googleClientId,
      client_secret: this.authConfig.googleClientSecret,
      redirect_uri: this.authConfig.googleRedirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new Error('google token exchange failed');
    const json = (await response.json()) as { id_token?: string };
    if (!json.id_token) throw new Error('missing id_token');
    return json.id_token;
  }

  private async verifyIdToken(idToken: string, nonce: string) {
    try {
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: this.authConfig.googleClientId,
      });
      if (payload.nonce !== nonce || typeof payload.sub !== 'string')
        return null;
      return {
        sub: payload.sub,
        email:
          typeof payload.email === 'string' ? payload.email.toLowerCase() : '',
        emailVerified: payload.email_verified === true,
        name: typeof payload.name === 'string' ? payload.name : '',
        picture: typeof payload.picture === 'string' ? payload.picture : null,
      };
    } catch {
      return null;
    }
  }

  private async resolveUser(claims: {
    sub: string;
    email: string;
    name: string;
    picture: string | null;
  }): Promise<{ ok: true; user: UserEntity } | { ok: false; error: string }> {
    const identity = await this.identities.findOne({
      where: { provider: AuthProvider.GOOGLE, providerUserId: claims.sub },
    });
    if (identity) {
      const user = await this.users.findOneBy({ id: identity.userId });
      if (!user) return { ok: false, error: 'oauth_state' };
      identity.lastUsedAt = new Date();
      await this.identities.save(identity);
      return { ok: true, user };
    }

    if (!claims.email) return { ok: false, error: 'email_unverified' };
    const existing = await this.users.findOne({
      where: { email: claims.email },
    });
    if (existing && !existing.emailVerifiedAt) {
      return { ok: false, error: 'link_required' };
    }

    const user =
      existing ??
      (await this.users.save(
        this.users.create({
          email: claims.email,
          emailVerifiedAt: new Date(),
          displayName: (
            claims.name ||
            claims.email.split('@')[0] ||
            'Người dùng'
          ).slice(0, 100),
          avatarUrl: claims.picture?.slice(0, 512) ?? null,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          passwordHash: null,
          locale: 'vi',
          failedLoginCount: 0,
        }),
      ));

    if (existing && !existing.emailVerifiedAt) {
      return { ok: false, error: 'link_required' };
    }
    if (existing && !existing.avatarUrl && claims.picture) {
      existing.avatarUrl = claims.picture.slice(0, 512);
      await this.users.save(existing);
    }

    await this.identities.save(
      this.identities.create({
        userId: user.id,
        provider: AuthProvider.GOOGLE,
        providerUserId: claims.sub,
        emailAtLink: claims.email,
        lastUsedAt: new Date(),
      }),
    );
    return { ok: true, user };
  }

  private async touchAuthTime(userId: string): Promise<void> {
    const session = await this.sessionRows.findOne({
      where: { userId, revokedAt: IsNull() },
      order: { lastSeenAt: 'DESC' },
    });
    if (!session) return;
    session.authTime = new Date();
    await this.sessionRows.save(session);
    await this.redis.getClient().hset(REDIS_KEYS.sessionActive(session.id), {
      authTime: String(session.authTime.getTime()),
    });
    await this.sessions.record(
      'reauth_success',
      userId,
      session.id,
      null,
      null,
    );
  }
}
