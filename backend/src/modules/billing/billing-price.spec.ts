import { describe, expect, it } from 'vitest';
import { billingPrice, parseTestPrice } from './billing.constants.js';

describe('billingPrice', () => {
  it('không đặt giá thử thì dùng bảng giá thật', () => {
    expect(billingPrice('subscription', 'unlimited', 'month')).toBe(30_000);
    expect(billingPrice('subscription', 'unlimited', 'year')).toBe(300_000);
    expect(billingPrice('subscription', 'valued', 'month')).toBe(60_000);
    expect(billingPrice('subscription', 'valued', 'year')).toBe(600_000);
    expect(billingPrice('valuation_credit', undefined, undefined)).toBe(10_000);
  });

  it('đặt giá thử thì mọi gói, mọi kỳ và lượt định giá đều thu đúng số đó', () => {
    expect(billingPrice('subscription', 'unlimited', 'month', 2_000)).toBe(
      2_000,
    );
    expect(billingPrice('subscription', 'unlimited', 'year', 2_000)).toBe(
      2_000,
    );
    expect(billingPrice('subscription', 'valued', 'month', 2_000)).toBe(2_000);
    expect(billingPrice('subscription', 'valued', 'year', 2_000)).toBe(2_000);
    expect(billingPrice('valuation_credit', undefined, undefined, 2_000)).toBe(
      2_000,
    );
  });

  it('gói hoặc kỳ không hợp lệ vẫn bị từ chối khi đang dùng giá thử', () => {
    expect(billingPrice('subscription', undefined, 'month', 2_000)).toBeNull();
    expect(billingPrice('subscription', 'valued', undefined, 2_000)).toBeNull();
  });
});

describe('parseTestPrice', () => {
  it('để trống hoặc chỉ có khoảng trắng thì tắt giá thử', () => {
    expect(parseTestPrice(undefined)).toBeNull();
    expect(parseTestPrice('')).toBeNull();
    expect(parseTestPrice('   ')).toBeNull();
  });

  it('nhận số nguyên trong khoảng cho phép', () => {
    expect(parseTestPrice('2000')).toBe(2_000);
    expect(parseTestPrice(' 2000 ')).toBe(2_000);
    expect(parseTestPrice('1000')).toBe(1_000);
    expect(parseTestPrice('1000000')).toBe(1_000_000);
  });

  it.each(['abc', '2.000', '2,000', '2000.5', '-2000', '0', '999', '1000001'])(
    'từ chối giá trị sai "%s" thay vì âm thầm dùng giá khác',
    (raw) => {
      expect(() => parseTestPrice(raw)).toThrow(/BILLING_TEST_PRICE_VND/);
    },
  );
});
