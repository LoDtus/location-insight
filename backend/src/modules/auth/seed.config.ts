import { UserRole } from '../rbac/authorization.types.js';

/** Mật khẩu dùng chung cho tài khoản seed ở môi trường dev. */
export const SEED_PASSWORD = '12345678';

export const SEED_ACCOUNTS = [
  {
    email: 'admin@location-insight.local',
    username: 'quan-tri',
    displayName: 'Quản trị',
    city: 'Hà Nội',
    bio: 'Quản trị nội dung và gói của Địa Thế.',
    role: UserRole.ADMIN,
  },
  {
    email: 'user@location-insight.local',
    username: 'nguoi-dung',
    displayName: 'Người dùng',
    city: 'Hà Nội',
    bio: 'Đang xem nhà quanh Hồ Tây.',
    role: UserRole.USER,
  },
  {
    email: 'lan-anh@location-insight.local',
    username: 'lan-anh',
    displayName: 'Lan Anh',
    city: 'Hà Nội',
    bio: 'Hay hỏi về ngõ và giá quanh phố cổ.',
    role: UserRole.USER,
  },
  {
    email: 'minh-duc@location-insight.local',
    username: 'minh-duc',
    displayName: 'Minh Đức',
    city: 'Hà Nội',
    bio: 'Theo dõi tin rao gần Hồ Hoàn Kiếm.',
    role: UserRole.USER,
  },
] as const;
