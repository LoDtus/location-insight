import { SetMetadata } from '@nestjs/common';
import {
  Permission,
  QuotaName,
} from '../../modules/rbac/authorization.types.js';

export const PUBLIC_KEY = 'access:public';
export const AUTHENTICATED_KEY = 'access:authenticated';
export const PERMISSIONS_KEY = 'access:permissions';
export const QUOTA_KEY = 'access:quota';
export const RATE_LIMIT_KEY = 'access:rate-limit';
export const RECENT_AUTH_KEY = 'access:recent-auth';

export type AuthRateLimitAction =
  | 'google'
  | 'register'
  | 'login'
  | 'reset'
  | 'refresh'
  | 'sepay';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_KEY, true);
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const Quota = (name: QuotaName) => SetMetadata(QUOTA_KEY, name);
export const AuthRateLimit = (action: AuthRateLimitAction) =>
  SetMetadata(RATE_LIMIT_KEY, action);
export const RequireRecentAuth = () => SetMetadata(RECENT_AUTH_KEY, true);
