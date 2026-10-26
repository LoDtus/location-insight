import { describe, expect, it } from 'vitest';
import { assertRoutesDeclared } from './route-inventory.js';

describe('route inventory', () => {
  it('từ chối route chưa khai báo quyền', () => {
    expect(() =>
      assertRoutesDeclared([
        {
          name: '/secret POST',
          method: 'POST',
          isPublic: false,
          isAuthenticated: false,
          hasPermission: false,
          hasRateLimit: false,
        },
      ]),
    ).toThrow(/thiếu metadata/);
  });

  it('từ chối route ghi công khai khi chưa có rate limit', () => {
    expect(() =>
      assertRoutesDeclared([
        {
          name: '/auth/login POST',
          method: 'POST',
          isPublic: true,
          isAuthenticated: false,
          hasPermission: false,
          hasRateLimit: false,
        },
      ]),
    ).toThrow(/rate limit/);
  });

  it('chấp nhận route đã khai báo', () => {
    expect(() =>
      assertRoutesDeclared([
        {
          name: '/health GET',
          method: 'GET',
          isPublic: true,
          isAuthenticated: false,
          hasPermission: false,
          hasRateLimit: false,
        },
      ]),
    ).not.toThrow();
  });
});
