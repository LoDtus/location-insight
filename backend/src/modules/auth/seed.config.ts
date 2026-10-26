import { UserRole } from '../rbac/authorization.types.js';

/** Mật khẩu dùng chung cho tài khoản seed ở môi trường dev. */
export const SEED_PASSWORD = '12345678';

export const SEED_ACCOUNTS = [
  {
    email: 'admin@location-insight.local',
    displayName: 'Quản trị',
    role: UserRole.ADMIN,
  },
  {
    email: 'user@location-insight.local',
    displayName: 'Người dùng',
    role: UserRole.USER,
  },
] as const;
