import { describe, expect, it } from 'vitest';
import {
  assertSafeKey,
  parseOrigins,
  planSigning,
  resolveStorageSettings,
} from './storage.config.js';

const BASE: Record<string, string> = {
  S3_ENDPOINT: 'http://minio:9000',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
};

const read =
  (extra: Record<string, string> = {}) =>
  (name: string) =>
    ({ ...BASE, ...extra })[name];

describe('resolveStorageSettings', () => {
  it('dev: tự tạo bucket, endpoint công khai mặc định là endpoint nội bộ', () => {
    const settings = resolveStorageSettings(read({ NODE_ENV: 'development' }));
    expect(settings.autoCreateBucket).toBe(true);
    expect(settings.publicEndpoint).toBe('http://minio:9000');
    expect(settings.region).toBe('us-east-1');
    expect(settings.requestTimeoutMs).toBe(5000);
  });

  it('production: không tự tạo bucket và bắt buộc S3_PUBLIC_ENDPOINT', () => {
    expect(() =>
      resolveStorageSettings(read({ NODE_ENV: 'production' })),
    ).toThrow('S3_PUBLIC_ENDPOINT');
    const settings = resolveStorageSettings(
      read({
        NODE_ENV: 'production',
        S3_PUBLIC_ENDPOINT: 'https://media.example.com',
      }),
    );
    expect(settings.autoCreateBucket).toBe(false);
    expect(settings.publicEndpoint).toBe('https://media.example.com');
  });

  it('cờ S3_AUTO_CREATE_BUCKET ghi đè mặc định', () => {
    const settings = resolveStorageSettings(
      read({ S3_AUTO_CREATE_BUCKET: 'false' }),
    );
    expect(settings.autoCreateBucket).toBe(false);
  });

  it('báo rõ biến thiếu', () => {
    expect(() =>
      resolveStorageSettings((name) =>
        name === 'S3_BUCKET' ? '' : BASE[name],
      ),
    ).toThrow('S3_BUCKET');
  });

  it('CORS: ưu tiên S3_CORS_ORIGINS, rơi về CORS_ORIGINS, loại dấu *', () => {
    expect(
      resolveStorageSettings(read({ CORS_ORIGINS: 'http://a.test, *' }))
        .corsOrigins,
    ).toEqual(['http://a.test']);
    expect(
      resolveStorageSettings(
        read({
          CORS_ORIGINS: 'http://a.test',
          S3_CORS_ORIGINS: 'http://b.test',
        }),
      ).corsOrigins,
    ).toEqual(['http://b.test']);
  });

  it('timeout không hợp lệ rơi về mặc định', () => {
    expect(
      resolveStorageSettings(read({ S3_REQUEST_TIMEOUT_MS: 'abc' }))
        .requestTimeoutMs,
    ).toBe(5000);
    expect(
      resolveStorageSettings(read({ S3_REQUEST_TIMEOUT_MS: '2000' }))
        .requestTimeoutMs,
    ).toBe(2000);
  });
});

describe('parseOrigins', () => {
  it('rỗng khi không cấu hình', () => {
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins(' , ')).toEqual([]);
  });
});

describe('assertSafeKey', () => {
  it('chấp nhận khóa do server sinh', () => {
    expect(() => assertSafeKey('messaging/abc/0190-uuid.jpg')).not.toThrow();
  });

  it.each(['', '/abs', 'a/../b', '..', 'a/./b', 'a\\b', 'x'.repeat(513)])(
    'từ chối %j',
    (key) => {
      expect(() => assertSafeKey(key)).toThrow('Khóa đối tượng không hợp lệ');
    },
  );
});

describe('planSigning', () => {
  const now = Date.UTC(2026, 10, 3, 10, 7, 30);

  it('không có cửa sổ: ký tại thời điểm hiện tại', () => {
    const plan = planSigning(600, 3600, now);
    expect(plan.signingDate.getTime()).toBe(now);
    expect(plan.expiresIn).toBe(600);
  });

  it('chặn theo trần của loại URL', () => {
    expect(planSigning(99999, 3600, now).expiresIn).toBe(3600);
    expect(planSigning(0, 3600, now).expiresIn).toBe(1);
  });

  it('cửa sổ: cùng mốc ký trong một cửa sổ, URL còn ít nhất ttl', () => {
    const a = planSigning(600, 3600, now, 600);
    const b = planSigning(600, 3600, now + 120_000, 600);
    expect(a.signingDate.getTime()).toBe(b.signingDate.getTime());
    expect(a.signingDate.getTime()).toBe(Date.UTC(2026, 10, 3, 10, 0, 0));
    expect(a.signingDate.getTime() + a.expiresIn * 1000).toBeGreaterThanOrEqual(
      now + 600_000,
    );
  });
});
