import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DevResetGuard } from './dev-reset.guard.js';

const TOKEN = 'b'.repeat(40);
const ORIGINAL = { ...process.env };

function context(headers: Record<string, string>, ip = '172.18.0.5'): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers, ip }) }),
  } as unknown as ExecutionContext;
}

describe('DevResetGuard', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'development',
      DEV_RESET_ENABLED: 'true',
      DEV_RESET_TOKEN: TOKEN,
      TYPEORM_SYNCHRONIZE: 'true',
      DATABASE_HOST: 'postgres',
      DATABASE_NAME: 'location_insight',
    });
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  const guard = new DevResetGuard();

  it('cho qua khi token đúng và mạng nội bộ', () => {
    expect(guard.canActivate(context({ 'x-dev-reset-token': TOKEN, 'x-forwarded-for': '192.168.1.9' }))).toBe(true);
  });

  it('404 khi production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => guard.canActivate(context({ 'x-dev-reset-token': TOKEN }))).toThrow(NotFoundException);
  });

  it('403 khi sai/thiếu token', () => {
    expect(() => guard.canActivate(context({}))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context({ 'x-dev-reset-token': 'x'.repeat(40) }))).toThrow(ForbiddenException);
  });

  it('403 khi có Origin (gọi từ trình duyệt)', () => {
    expect(() =>
      guard.canActivate(context({ 'x-dev-reset-token': TOKEN, origin: 'http://evil.example' })),
    ).toThrow(ForbiddenException);
  });

  it('403 khi IP công khai ở bất kỳ vị trí nào', () => {
    expect(() => guard.canActivate(context({ 'x-dev-reset-token': TOKEN }, '8.8.8.8'))).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(context({ 'x-dev-reset-token': TOKEN, 'x-forwarded-for': '8.8.8.8, 10.0.0.1' })),
    ).toThrow(ForbiddenException);
  });
});
