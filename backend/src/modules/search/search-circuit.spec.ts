import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from './search-circuit.js';

describe('CircuitBreaker', () => {
  it('mở sau 3 lỗi liên tiếp và từ chối trong thời gian mở', () => {
    let now = 0;
    const breaker = new CircuitBreaker(3, 30_000, () => now);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(true);
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(false);
    now = 29_999;
    expect(breaker.canRequest()).toBe(false);
  });

  it('một lần thành công xóa bộ đếm lỗi', () => {
    const breaker = new CircuitBreaker(3, 30_000, () => 0);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(true);
  });

  it('sau thời gian mở cho thử lại; lỗi tiếp theo mở lại ngay, thành công thì đóng', () => {
    let now = 0;
    const breaker = new CircuitBreaker(3, 30_000, () => now);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    now = 30_000;
    expect(breaker.canRequest()).toBe(true);
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(false);
    now = 60_000;
    expect(breaker.canRequest()).toBe(true);
    breaker.recordSuccess();
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(true);
  });
});
