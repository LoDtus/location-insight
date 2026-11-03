import { describe, expect, it } from 'vitest';
import { clampPage, normalizeQuery } from './search-text.js';

describe('normalizeQuery', () => {
  it('trả null khi dưới 2 ký tự sau chuẩn hóa: không dùng ES', () => {
    expect(normalizeQuery('')).toBeNull();
    expect(normalizeQuery('   ')).toBeNull();
    expect(normalizeQuery(' a ')).toBeNull();
  });

  it('gộp khoảng trắng, bỏ ký tự điều khiển', () => {
    expect(normalizeQuery('  hoan \t\n kiem\u0000  ')).toBe('hoan kiem');
  });

  it('đưa Unicode dạng NFD về NFC', () => {
    const nfd = 'Hoàn Kiếm'.normalize('NFD');
    expect(nfd).not.toBe('Hoàn Kiếm');
    expect(normalizeQuery(nfd)).toBe('Hoàn Kiếm');
  });

  it('cắt còn tối đa 8 từ', () => {
    expect(normalizeQuery('a1 b2 c3 d4 e5 f6 g7 h8 i9 j0')).toBe(
      'a1 b2 c3 d4 e5 f6 g7 h8',
    );
  });

  it('cắt còn tối đa 120 ký tự', () => {
    const result = normalizeQuery('x'.repeat(500));
    expect(result).toHaveLength(120);
  });

  it('giữ nguyên ký tự đặc biệt: chúng chỉ là chữ, không phải cú pháp', () => {
    expect(normalizeQuery('"a*" (b) \\ c:d')).toBe('"a*" (b) \\ c:d');
  });
});

describe('clampPage', () => {
  it('giới hạn size ≤ 50 và from + size ≤ 1000', () => {
    expect(clampPage({ size: 500, from: 0 })).toEqual({ size: 50, from: 0 });
    expect(clampPage({ size: 20, from: 5000 })).toEqual({
      size: 20,
      from: 980,
    });
  });

  it('chặn giá trị âm hoặc không phải số', () => {
    expect(clampPage({ size: -3, from: -9 })).toEqual({ size: 1, from: 0 });
    expect(clampPage({ size: Number.NaN, from: Number.NaN })).toEqual({
      size: 1,
      from: 0,
    });
  });
});
