import { describe, expect, it } from 'vitest';

import { engagementScore, isBotAgent, recommendScore, topicAffinity, wilsonLower } from './article-discovery.js';

const NOW = new Date('2026-11-08T00:00:00Z');
const base = { id: 'a', topic: 'gia', publishedAt: NOW, views: 100, upvotes: 0, downvotes: 0, comments: 0 };

describe('xếp hạng trang bài viết', () => {
  it('tỷ lệ thích có hiệu chỉnh ưu tiên nhiều phiếu hơn 1/1', () => {
    expect(wilsonLower(1, 0)).toBeLessThan(wilsonLower(40, 4));
    expect(wilsonLower(0, 0)).toBe(0);
  });

  it('bình luận nặng hơn phiếu', () => {
    expect(engagementScore({ comments: 2, upvotes: 0, downvotes: 0 })).toBeGreaterThan(engagementScore({ comments: 0, upvotes: 5, downvotes: 0 }));
  });

  it('đề xuất: bài mới, hợp chủ đề được điểm cao hơn', () => {
    const old = { ...base, publishedAt: new Date('2026-05-01T00:00:00Z') };
    expect(recommendScore(base, NOW)).toBeGreaterThan(recommendScore(old, NOW));
    expect(recommendScore(base, NOW, 1)).toBeGreaterThan(recommendScore(base, NOW, 0));
  });

  it('trọng số chủ đề chuẩn hóa 0..1, không âm', () => {
    const map = topicAffinity([
      { topic: 'gia', weight: 2 },
      { topic: 'gia', weight: 3 },
      { topic: 'khu-vuc', weight: -1 },
      { topic: 'du-lieu', weight: 2 },
    ]);
    expect(map.get('gia')).toBe(1);
    expect(map.get('du-lieu')).toBeCloseTo(0.4);
    expect(map.get('khu-vuc')).toBe(0);
  });

  it('nhận ra bot và yêu cầu không có trình duyệt', () => {
    expect(isBotAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBotAgent(undefined)).toBe(true);
    expect(isBotAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36')).toBe(false);
  });
});
