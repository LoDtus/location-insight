import { describe, expect, it } from 'vitest';
import {
  aliasName,
  indexCandidates,
  parseIndexVersion,
} from './search-names.js';

describe('tên index và alias', () => {
  it('alias không có hậu tố phiên bản, có tiền tố tùy chọn', () => {
    expect(aliasName('', 'discussion-topics')).toBe('discussion-topics');
    expect(aliasName('li-dev-', 'discussion-topics')).toBe(
      'li-dev-discussion-topics',
    );
  });

  it('index luân phiên -vN và -vN-b', () => {
    expect(indexCandidates('', 'places', 2)).toEqual([
      'places-v2',
      'places-v2-b',
    ]);
  });

  it('đọc phiên bản từ tên index', () => {
    expect(parseIndexVersion('places-v3')).toBe(3);
    expect(parseIndexVersion('places-v12-b')).toBe(12);
    expect(parseIndexVersion('places')).toBeNull();
  });
});
