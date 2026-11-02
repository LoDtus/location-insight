import { randomInt } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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
    let user =
      (await this.users.findOne({ where: { email }, withDeleted: true })) ??
      (await this.users.findOne({
        where: { username: account.username },
        withDeleted: true,
      }));
    const created = !user;
    if (!user) {
      user = this.users.create({
        email,
        username: account.username,
        displayName: account.displayName,
        avatarUrl: null,
        city: account.city,
        bio: account.bio,
        role: account.role,
        status: UserStatus.ACTIVE,
        passwordHash: null,
        locale: 'vi',
        failedLoginCount: 0,
        emailVerifiedAt: new Date(),
        planCode: await this.uniquePlanCode(),
      });
    }
    if (user.deletedAt) user.deletedAt = null;

    user.email = email;
    if (!user.username) user.username = account.username;
    if (!user.city) user.city = account.city;
    if (!user.bio) user.bio = account.bio;
    if (!user.planCode) user.planCode = await this.uniquePlanCode();
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
    await this.users.query('UPDATE users SET created_at = $1 WHERE id = $2', [
      account.joinedAt,
      user.id,
    ]);
    await this.ensurePasswordIdentity(user.id, email);
    if (created || !alreadyValid) {
      const label = account.role === UserRole.ADMIN ? 'admin' : 'user';
      this.logger.log(
        `${created ? 'Đã tạo' : 'Đã đặt lại mật khẩu'} ${label} ${email}`,
      );
    }
  }

  private async uniquePlanCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = createPlanCode();
      const taken = await this.users.findOne({
        where: { planCode: code },
        withDeleted: true,
      });
      if (!taken) return code;
    }
    const fallback = await this.users.count({
      where: { planCode: IsNull() },
      withDeleted: true,
    });
    return createPlanCode().slice(0, 6) + String(fallback % 100).padStart(2, '0');
  }

  private async ensurePasswordIdentity(
    userId: string,
    email: string,
  ): Promise<void> {
    const existing = await this.identities.findOne({
      where: { provider: AuthProvider.PASSWORD, providerUserId: userId },
    });
    if (existing) {
      if (existing.emailAtLink !== email) {
        existing.emailAtLink = email;
        await this.identities.save(existing);
      }
      return;
    }
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

function createPlanCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const all = letters + digits;
  const chars = [letters[randomInt(26)] ?? 'A', digits[randomInt(10)] ?? '0'];
  while (chars.length < 8) chars.push(all[randomInt(36)] ?? 'A');
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    const current = chars[index] ?? 'A';
    chars[index] = chars[swap] ?? 'A';
    chars[swap] = current;
  }
  return chars.join('');
}
