import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_PURGE_AFTER_DAYS,
  anonymizedEmail,
  purgeCutoff,
} from './account-retention.js';

describe('account retention', () => {
  it('hạn xóa dữ liệu cá nhân là 30 ngày như chính sách bảo mật', () => {
    const now = new Date('2026-11-30T00:00:00Z');
    expect(ACCOUNT_PURGE_AFTER_DAYS).toBe(30);
    expect(purgeCutoff(now).toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('email ẩn danh duy nhất theo id và không phải địa chỉ thật', () => {
    expect(anonymizedEmail('abc')).toBe('deleted-abc@deleted.invalid');
    expect(anonymizedEmail('abc').length).toBeLessThanOrEqual(254);
  });
});
