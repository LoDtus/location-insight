import { describe, expect, it } from 'vitest';
import { seedCommentCount, seedDailyViews, seededUnit, seedPopularity, seedVotePlan } from './seed-article-engagement.js';

describe('seed-article-engagement', () => {
  it('tất định theo khóa và nằm trong [0, 1)', () => {
    expect(seededUnit('a')).toBe(seededUnit('a'));
    for (const key of ['a', 'b', 'khung-gia', 'ghim-lech']) {
      expect(seededUnit(key)).toBeGreaterThanOrEqual(0);
      expect(seededUnit(key)).toBeLessThan(1);
      expect(seedPopularity(key)).toBeLessThanOrEqual(1);
    }
  });

  it('lượt đọc chỉ từ ngày đăng trở đi và không âm', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];
    const rows = seedDailyViews('khung-gia', '2026-11-03', days);
    expect(rows.map((row) => row.day).every((day) => day >= '2026-11-03')).toBe(true);
    expect(rows.every((row) => row.views > 0)).toBe(true);
  });

  it('phiếu bầu không vượt số người và bình luận không vượt giới hạn', () => {
    for (const slug of ['a', 'b', 'c', 'khung-gia', 'tuyen-metro-moi-va-ban-kinh']) {
      const plan = seedVotePlan(slug, 15);
      expect(plan.up + plan.down).toBeLessThanOrEqual(15);
      expect(plan.down).toBeGreaterThanOrEqual(0);
      expect(seedCommentCount(slug, 6)).toBeLessThanOrEqual(6);
    }
  });
});
