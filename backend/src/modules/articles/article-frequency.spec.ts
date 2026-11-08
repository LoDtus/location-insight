import { describe, expect, it } from 'vitest';

import { bucketOfDay, bucketRange, isBucketKey, nextBucket, vnDayKey, zonedStart } from './article-frequency.js';

describe('mốc biểu đồ số bài đã đăng', () => {
  it('kiểm tra khóa mốc hợp lệ, kể cả ngày không tồn tại', () => {
    expect(isBucketKey('day', '2026-02-28')).toBe(true);
    expect(isBucketKey('day', '2026-02-30')).toBe(false);
    expect(isBucketKey('month', '2026-13')).toBe(false);
    expect(isBucketKey('year', '2026')).toBe(true);
    expect(isBucketKey('day', '2026-02')).toBe(false);
  });

  it('ngày theo giờ Việt Nam và mốc chứa ngày đó', () => {
    expect(vnDayKey(new Date('2026-11-07T17:30:00Z'))).toBe('2026-11-08');
    expect(bucketOfDay('month', '2026-11-08')).toBe('2026-11');
    expect(bucketOfDay('year', '2026-11-08')).toBe('2026');
    expect(zonedStart('day', '2026-11-08').toISOString()).toBe('2026-11-07T17:00:00.000Z');
  });

  it('chuyển mốc qua năm và dải mốc có giới hạn', () => {
    expect(nextBucket('month', '2026-12')).toBe('2027-01');
    expect(nextBucket('day', '2026-12-31')).toBe('2027-01-01');
    expect(bucketRange('month', '2026-06', '2026-11', 60)).toHaveLength(6);
    expect(bucketRange('day', '2026-01-01', '2026-12-31', 300)).toBeNull();
  });
});
