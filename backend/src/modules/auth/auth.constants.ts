import { createHash, randomBytes } from 'node:crypto';
import { UserRole } from '../rbac/authorization.types.js';

export const AUTH_LIMITS = {
  accessTtlSeconds: 900,
  sessionActiveTtlSeconds: 20 * 60,
  refreshGraceSeconds: 10,
  idleDays: 14,
  absoluteDays: 30,
  /** Phiên không chọn duy trì: cookie theo phiên trình duyệt, hạn server ngắn hơn. */
  sessionIdleHours: 12,
  sessionAbsoluteDays: 1,
  maxSessions: 10,
  recentAuthSeconds: 600,
  oauthStateTtlSeconds: 10 * 60,
  wsTicketTtlSeconds: 30,
  oneTimeTokenMinutes: 15,
  eventRetentionMonths: 12,
  revokedSessionRetentionDays: 30,
  passwordHashConcurrency: 4,
  reconcileIntervalMs: 60_000,
  cleanupIntervalMs: 24 * 60 * 60 * 1000,
} as const;

export const AUTH_RATE_LIMITS = {
  loginIp: { limit: 20, windowSeconds: 15 * 60 },
  loginFreeFailures: 5,
  loginBackoffMaxSeconds: 15 * 60,
  registerIp: { limit: 5, windowSeconds: 60 * 60 },
  resetEmail: { limit: 3, windowSeconds: 60 * 60 },
  resetIp: { limit: 10, windowSeconds: 60 * 60 },
  refreshSession: { limit: 30, windowSeconds: 60 },
  googleIp: { limit: 30, windowSeconds: 10 * 60 },
  sepayIp: { limit: 300, windowSeconds: 60 },
  unsubscribeIp: { limit: 30, windowSeconds: 10 * 60 },
  apiUser: { limit: 300, windowSeconds: 60 },
} as const;

export const REFRESH_COOKIE = '__Secure-dt_rt';
export const REQUESTED_WITH = 'dt';

export const REDIS_KEYS = {
  sessionActive: (sid: string) => `session:active:${sid}`,
  sessionRevoked: (sid: string) => `session:revoked:${sid}`,
  authz: (userId: string) => `cache:authz:${userId}`,
  oauthState: (state: string) => `oauth:state:${state}`,
  wsTicket: (ticket: string) => `ticket:ws:${ticket}`,
  loginIp: (ip: string) => `ratelimit:login:ip_${ip}`,
  loginAccount: (emailHash: string) => `ratelimit:login:acct_${emailHash}`,
  registerIp: (ip: string) => `ratelimit:register:ip_${ip}`,
  resetIp: (ip: string) => `ratelimit:reset:ip_${ip}`,
  resetAccount: (emailHash: string) => `ratelimit:reset:acct_${emailHash}`,
  refreshSession: (sid: string) => `ratelimit:refresh:sid_${sid}`,
  googleIp: (ip: string) => `ratelimit:google:ip_${ip}`,
  sepayIp: (ip: string) => `ratelimit:sepay:ip_${ip}`,
  unsubscribeIp: (ip: string) => `ratelimit:unsubscribe:ip_${ip}`,
};

export const REDIS_CHANNELS = {
  sessionRevoked: 'events:session:revoked',
  authzChanged: 'events:authz:changed',
} as const;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function clientIp(ip: string | undefined): string {
  const value = ip || 'unknown';
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  const groups = ip.split(':').filter(Boolean);
  return groups.length ? `${groups.slice(0, 2).join(':')}::` : ip;
}

export function deviceLabelFromAgent(userAgent: string | undefined): string {
  const label = (userAgent || 'Trình duyệt').replace(/\s+/g, ' ').trim();
  return (label || 'Trình duyệt').slice(0, 80);
}

export function safeRedirect(
  value: string | undefined,
  allowed: string[],
): string {
  const fallback = '/app/properties';
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return fallback;
  }
  if (value.includes('://')) return fallback;
  const ok = allowed.some(
    (entry) => value === entry || value.startsWith(`${entry}/`),
  );
  return ok ? value : fallback;
}

export function homeForRole(role: string): string {
  return role === UserRole.ADMIN ? '/admin/properties' : '/app/properties';
}

export function redirectForRole(role: string, requested: string): string {
  const root = role === UserRole.ADMIN ? '/admin' : '/app';
  if (
    requested === root ||
    (requested.startsWith(`${root}/`) &&
      !requested.startsWith('//') &&
      !requested.includes('\\'))
  ) {
    return requested;
  }
  return homeForRole(role);
}
