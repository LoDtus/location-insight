import '../src/load-env.js';
import { DataSource } from 'typeorm';
import { AuthEventEntity } from '../src/modules/auth/entities/auth-event.entity.js';
import {
  UserEntity,
  UserStatus,
} from '../src/modules/auth/entities/user.entity.js';
import { AdminAuditLogEntity } from '../src/modules/rbac/entities/admin-audit-log.entity.js';
import { UserRole } from '../src/modules/rbac/authorization.types.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const email = argument('email')?.trim().toLowerCase();
const displayName = argument('display-name')?.trim();

if (!email || !email.includes('@')) {
  console.error(
    'Cách dùng: npm run admin:grant -- --email you@example.com --display-name "Tên"',
  );
  process.exit(1);
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [UserEntity, AuthEventEntity, AdminAuditLogEntity],
  synchronize: false,
});

await dataSource.initialize();
try {
  const users = dataSource.getRepository(UserEntity);
  let user = await users.findOne({ where: { email } });
  const created = !user;
  if (!user) {
    user = await users.save(
      users.create({
        email,
        displayName: displayName || email.split('@')[0] || 'Admin',
        emailVerifiedAt: new Date(),
        avatarUrl: null,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash: null,
        locale: 'vi',
        failedLoginCount: 0,
      }),
    );
  } else {
    user.role = UserRole.ADMIN;
    user.status = UserStatus.ACTIVE;
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
    await users.save(user);
  }

  await dataSource.getRepository(AuthEventEntity).save({
    userId: user.id,
    sessionId: null,
    type: 'admin_grant',
    ipAddress: null,
    userAgent: 'cli',
    meta: { created },
  });
  await dataSource.getRepository(AdminAuditLogEntity).save({
    actorId: null,
    actorType: 'cli',
    action: 'admin_grant',
    targetType: 'user',
    targetId: user.id,
    before: null,
    after: { role: UserRole.ADMIN },
    reason: 'Cấp quyền quản trị bằng CLI',
    ipAddress: null,
    sessionId: null,
  });
  console.log(
    `${created ? 'Đã tạo' : 'Đã cập nhật'} admin ${user.email} (${user.id})`,
  );
} finally {
  await dataSource.destroy();
}
