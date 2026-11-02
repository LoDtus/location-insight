import { describe, expect, it } from 'vitest';
import {
  forwardedIps,
  isLocalDatabaseHost,
  isPrivateOrLoopbackIp,
} from './dev-reset.network.js';
import { evaluateDevResetPolicy } from './dev-reset.policy.js';

const TOKEN = 'a'.repeat(40);

function devEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DEV_RESET_ENABLED: 'true',
    DEV_RESET_TOKEN: TOKEN,
    TYPEORM_SYNCHRONIZE: 'true',
    DATABASE_HOST: 'postgres',
    DATABASE_NAME: 'location_insight',
    ...overrides,
  };
}

describe('evaluateDevResetPolicy', () => {
  it('cho phép khi đủ điều kiện dev', () => {
    expect(evaluateDevResetPolicy(devEnv())).toEqual({ allowed: true, problems: [] });
  });

  it.each([
    ['NODE_ENV production', { NODE_ENV: 'production' }],
    ['NODE_ENV thiếu', { NODE_ENV: undefined }],
    ['NODE_ENV test', { NODE_ENV: 'test' }],
    ['cờ tắt', { DEV_RESET_ENABLED: 'false' }],
    ['cờ thiếu', { DEV_RESET_ENABLED: undefined }],
    ['cờ viết hoa', { DEV_RESET_ENABLED: 'TRUE' }],
    ['token thiếu', { DEV_RESET_TOKEN: undefined }],
    ['token ngắn', { DEV_RESET_TOKEN: 'short' }],
    ['APP_ENV production', { APP_ENV: 'Production' }],
    ['ENVIRONMENT staging', { ENVIRONMENT: 'staging' }],
    ['Kubernetes', { KUBERNETES_SERVICE_HOST: '10.0.0.1' }],
    ['không synchronize', { TYPEORM_SYNCHRONIZE: 'false' }],
    ['database công khai', { DATABASE_HOST: 'db.example.com' }],
    ['database RDS', { DATABASE_HOST: 'x.rds.amazonaws.com' }],
    ['database IP công khai', { DATABASE_HOST: '8.8.8.8' }],
    ['tên database production', { DATABASE_NAME: 'location_insight_prod' }],
  ])('từ chối: %s', (_name, overrides) => {
    const policy = evaluateDevResetPolicy(devEnv(overrides));
    expect(policy.allowed).toBe(false);
    expect(policy.problems.length).toBeGreaterThan(0);
  });

  it('chấp nhận database cục bộ thường gặp', () => {
    for (const host of ['localhost', '127.0.0.1', '192.168.1.20', '10.0.0.5', 'postgres', 'host.docker.internal']) {
      expect(evaluateDevResetPolicy(devEnv({ DATABASE_HOST: host })).allowed).toBe(true);
    }
  });
});

describe('isPrivateOrLoopbackIp', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.0.9', '::1', '::ffff:192.168.1.5', 'fd12::1', 'fe80::1'])(
    'riêng tư: %s',
    (ip) => expect(isPrivateOrLoopbackIp(ip)).toBe(true),
  );
  it.each(['8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.0.1', '1.2.3.4', '2001:4860:4860::8888', '', 'abc', '999.1.1.1'])(
    'không riêng tư: %s',
    (ip) => expect(isPrivateOrLoopbackIp(ip)).toBe(false),
  );
  it('undefined không riêng tư', () => expect(isPrivateOrLoopbackIp(undefined)).toBe(false));
});

describe('isLocalDatabaseHost / forwardedIps', () => {
  it('từ chối rỗng và tên miền có dấu chấm', () => {
    expect(isLocalDatabaseHost('')).toBe(false);
    expect(isLocalDatabaseHost(undefined)).toBe(false);
    expect(isLocalDatabaseHost('prod.internal.example.com')).toBe(false);
  });
  it('tách X-Forwarded-For', () => {
    expect(forwardedIps('1.1.1.1, 10.0.0.1')).toEqual(['1.1.1.1', '10.0.0.1']);
    expect(forwardedIps(undefined)).toEqual([]);
  });
});
