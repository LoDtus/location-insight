import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { EmailService } from '../email/email.service.js';
import { AUTH_LIMITS, randomToken, sha256 } from './auth.constants.js';
import { AuthConfig } from './auth.config.js';
import { AuthProvider } from './entities/auth-identity.entity.js';
import { AuthIdentityEntity } from './entities/auth-identity.entity.js';
import {
  AuthOneTimeTokenEntity,
  OneTimePurpose,
} from './entities/auth-one-time-token.entity.js';
import { SessionRevokeReason } from './entities/auth-session.entity.js';
import { UserEntity, UserStatus } from './entities/user.entity.js';
import { SessionService } from './session.service.js';

const ARGON = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const SAME_MESSAGE = 'Email hoặc mật khẩu không đúng.';

@Injectable()
export class PasswordService implements OnModuleInit {
  private readonly logger = new Logger(PasswordService.name);
  private dummyHash = '';
  private activeHashes = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly authConfig: AuthConfig,
    private readonly sessions: SessionService,
    private readonly email: EmailService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthIdentityEntity)
    private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(AuthOneTimeTokenEntity)
    private readonly tokens: Repository<AuthOneTimeTokenEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.authConfig.passwordEnabled) return;
    this.dummyHash = await this.hash('dummy-password-not-used');
  }

  hashPlain(password: string): Promise<string> {
    return this.hash(password);
  }

  matches(hash: string, password: string): Promise<boolean> {
    return this.verify(hash, password);
  }

  assertEnabled(): void {
    if (!this.authConfig.passwordEnabled) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Đăng nhập bằng mật khẩu đang tắt.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    ipAddress: string | null;
  }): Promise<void> {
    this.assertEnabled();
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    const passwordHash = await this.hash(input.password);
    if (existing) return;

    const user = await this.users.save(
      this.users.create({
        email,
        displayName: input.displayName.trim(),
        passwordHash,
        emailVerifiedAt: null,
        avatarUrl: null,
        username: null,
        city: null,
        bio: '',
        status: UserStatus.ACTIVE,
        locale: 'vi',
        failedLoginCount: 0,
      }),
    );
    await this.identities.save(
      this.identities.create({
        userId: user.id,
        provider: AuthProvider.PASSWORD,
        providerUserId: user.id,
        emailAtLink: email,
        lastUsedAt: null,
      }),
    );
    await this.issueToken(user, 'verify_email', input.ipAddress);
  }

  async verifyEmail(token: string): Promise<void> {
    const row = await this.consume(token, 'verify_email');
    await this.users.update(
      { id: row.userId },
      { emailVerifiedAt: new Date() },
    );
    const user = await this.users.findOne({ where: { id: row.userId } });
    if (user) {
      void this.email.send({
        template: 'welcome',
        to: this.recipient(user),
        dedupeKey: `welcome:${user.id}`,
      });
    }
  }

  async login(identifier: string, password: string): Promise<UserEntity> {
    this.assertEnabled();
    const value = identifier.trim().toLowerCase();
    const user = await this.users.findOne({
      where: value.includes('@') ? { email: value } : { username: value },
    });
    const hash = user?.passwordHash || this.dummyHash;
    const matches = hash ? await this.verify(hash, password) : false;
    const usable =
      matches &&
      user &&
      user.status === UserStatus.ACTIVE &&
      user.emailVerifiedAt &&
      user.passwordHash;

    if (!usable || !user) {
      if (user) {
        user.failedLoginCount += 1;
        await this.users.save(user);
        await this.sessions.record('login_failed', user.id, null, null, null);
      }
      throw new BusinessException(
        ErrorCode.INVALID_CREDENTIALS,
        'Email, tên đăng nhập hoặc mật khẩu không đúng.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }

    user.failedLoginCount = 0;
    await this.users.save(user);
    return user;
  }

  async forgot(email: string, ipAddress: string | null): Promise<void> {
    this.assertEnabled();
    const user = await this.users.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !user.passwordHash || !user.emailVerifiedAt) {
      await this.hash(randomToken(8));
      return;
    }
    await this.issueToken(user, 'reset_password', ipAddress);
  }

  async reset(token: string, password: string): Promise<void> {
    this.assertEnabled();
    const row = await this.consume(token, 'reset_password');
    const passwordHash = await this.hash(password);
    await this.users.update(
      { id: row.userId },
      { passwordHash, passwordChangedAt: new Date() },
    );
    await this.sessions.revokeAll(
      row.userId,
      SessionRevokeReason.PASSWORD_CHANGED,
    );
    await this.sessions.record(
      'password_changed',
      row.userId,
      null,
      null,
      null,
    );
    const user = await this.users.findOne({ where: { id: row.userId } });
    if (user) this.notifyPasswordChanged(user);
  }

  async change(
    user: UserEntity,
    currentPassword: string,
    newPassword: string,
    sessionId: string,
  ): Promise<void> {
    this.assertEnabled();
    const matches = user.passwordHash
      ? await this.verify(user.passwordHash, currentPassword)
      : false;
    if (!matches) {
      throw new BusinessException(
        ErrorCode.INVALID_CREDENTIALS,
        SAME_MESSAGE,
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }
    user.passwordHash = await this.hash(newPassword);
    user.passwordChangedAt = new Date();
    await this.users.save(user);
    await this.sessions.revokeAll(
      user.id,
      SessionRevokeReason.PASSWORD_CHANGED,
      sessionId,
    );
    await this.sessions.record(
      'password_changed',
      user.id,
      sessionId,
      null,
      null,
    );
    this.notifyPasswordChanged(user);
  }

  private recipient(user: UserEntity) {
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
    };
  }

  private notifyPasswordChanged(user: UserEntity): void {
    const now = new Date();
    void this.email.send({
      template: 'password_changed',
      to: this.recipient(user),
      vars: { changed_at: now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' },
      dedupeKey: `password_changed:${user.id}:${now.getTime()}`,
    });
  }

  async reauth(user: UserEntity, password: string): Promise<void> {
    this.assertEnabled();
    const matches = user.passwordHash
      ? await this.verify(user.passwordHash, password)
      : false;
    if (!matches) {
      throw new BusinessException(
        ErrorCode.INVALID_CREDENTIALS,
        SAME_MESSAGE,
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private async issueToken(
    user: UserEntity,
    purpose: OneTimePurpose,
    ipAddress: string | null,
  ): Promise<void> {
    const raw = randomToken();
    const expiresAt = new Date(
      Date.now() + AUTH_LIMITS.oneTimeTokenMinutes * 60 * 1000,
    );
    await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        purpose,
        tokenHash: sha256(raw),
        expiresAt,
        usedAt: null,
        ipAddress,
      }),
    );
    const isVerify = purpose === 'verify_email';
    const path = isVerify ? '/auth/verify-email' : '/auth/reset-password';
    const url = `${this.authConfig.websiteOrigin}${path}?token=${encodeURIComponent(raw)}`;
    await this.email.send({
      template: isVerify ? 'verify_email' : 'reset_password',
      to: this.recipient(user),
      vars: {
        [isVerify ? 'verify_url' : 'reset_url']: url,
        expires_minutes: String(AUTH_LIMITS.oneTimeTokenMinutes),
      },
    });
  }

  private async consume(
    token: string,
    purpose: OneTimePurpose,
  ): Promise<AuthOneTimeTokenEntity> {
    const row = await this.tokens.findOne({
      where: {
        tokenHash: sha256(token),
        purpose,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!row) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Token không hợp lệ hoặc đã hết hạn.',
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
    row.usedAt = new Date();
    await this.tokens.save(row);
    return row;
  }

  private async hash(password: string): Promise<string> {
    await this.acquire();
    try {
      return await argon2.hash(password, ARGON);
    } finally {
      this.release();
    }
  }

  private async verify(hash: string, password: string): Promise<boolean> {
    await this.acquire();
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.activeHashes < AUTH_LIMITS.passwordHashConcurrency) {
      this.activeHashes += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.activeHashes += 1;
  }

  private release(): void {
    this.activeHashes -= 1;
    this.waiters.shift()?.();
  }
}
