import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../rbac/authorization.types.js';
import { AuthConfig } from './auth.config.js';
import {
  AuthIdentityEntity,
  AuthProvider,
} from './entities/auth-identity.entity.js';
import { UserEntity, UserStatus } from './entities/user.entity.js';
import { PasswordService } from './password.service.js';
import { SEED_ACCOUNTS, SEED_PASSWORD } from './seed.config.js';

@Injectable()
export class SeedAccountService implements OnModuleInit {
  private readonly logger = new Logger(SeedAccountService.name);

  constructor(
    private readonly authConfig: AuthConfig,
    private readonly passwords: PasswordService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthIdentityEntity)
    private readonly identities: Repository<AuthIdentityEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    if (!this.authConfig.passwordEnabled) return;

    for (const account of SEED_ACCOUNTS) {
      await this.upsert(account);
    }
  }

  private async upsert(account: (typeof SEED_ACCOUNTS)[number]): Promise<void> {
    const email = account.email.toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    const created = !user;
    if (!user) {
      user = this.users.create({
        email,
        username: account.username,
        displayName: account.displayName,
        avatarUrl: null,
        city: 'Hà Nội',
        bio: '',
        role: account.role,
        status: UserStatus.ACTIVE,
        passwordHash: null,
        locale: 'vi',
        failedLoginCount: 0,
        emailVerifiedAt: new Date(),
      });
    }

    if (!user.username) user.username = account.username;
    user.role = account.role;
    user.status = UserStatus.ACTIVE;
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();

    const currentHash = user.passwordHash;
    const alreadyValid = currentHash
      ? await this.passwords.matches(currentHash, SEED_PASSWORD)
      : false;
    if (!alreadyValid) {
      user.passwordHash = await this.passwords.hashPlain(SEED_PASSWORD);
      user.passwordChangedAt = new Date();
    }

    user = await this.users.save(user);
    await this.ensurePasswordIdentity(user.id, email);
    if (created || !alreadyValid) {
      const label = account.role === UserRole.ADMIN ? 'admin' : 'user';
      this.logger.log(
        `${created ? 'Đã tạo' : 'Đã đặt lại mật khẩu'} ${label} ${email}`,
      );
    }
  }

  private async ensurePasswordIdentity(
    userId: string,
    email: string,
  ): Promise<void> {
    const existing = await this.identities.findOne({
      where: { provider: AuthProvider.PASSWORD, providerUserId: userId },
    });
    if (existing) return;
    await this.identities.save(
      this.identities.create({
        userId,
        provider: AuthProvider.PASSWORD,
        providerUserId: userId,
        emailAtLink: email,
        lastUsedAt: null,
      }),
    );
  }
}
