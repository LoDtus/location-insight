import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  GUEST_PERMISSIONS,
  PLAN_ENTITLEMENTS,
  PLAN_RANK,
  ROLE_PERMISSIONS,
  USER_PERMISSIONS,
  effectivePermissions,
  effectivePlan,
} from './authorization.config.js';
import { Plan, UserRole } from './authorization.types.js';

function containsAll(
  outer: readonly string[],
  inner: readonly string[],
): boolean {
  return inner.every((item) => outer.includes(item));
}

describe('authorization config', () => {
  it('quyền tăng dần theo vai trò', () => {
    expect(
      containsAll(
        ROLE_PERMISSIONS[UserRole.USER],
        ROLE_PERMISSIONS[UserRole.GUEST],
      ),
    ).toBe(true);
    expect(
      containsAll(
        ROLE_PERMISSIONS[UserRole.ADMIN],
        ROLE_PERMISSIONS[UserRole.USER],
      ),
    ).toBe(true);
    expect(
      containsAll(
        [...GUEST_PERMISSIONS, ...USER_PERMISSIONS, ...ADMIN_PERMISSIONS],
        ROLE_PERMISSIONS[UserRole.ADMIN],
      ),
    ).toBe(true);
  });

  it('quyền và hạn mức không giảm theo gói', () => {
    const plans = [Plan.FREE, Plan.UNLIMITED, Plan.VALUED];
    for (let index = 1; index < plans.length; index += 1) {
      const lower = PLAN_ENTITLEMENTS[plans[index - 1]];
      const higher = PLAN_ENTITLEMENTS[plans[index]];
      expect(containsAll(higher.permissions, lower.permissions)).toBe(true);
      expect(PLAN_RANK[plans[index]]).toBeGreaterThan(
        PLAN_RANK[plans[index - 1]],
      );
      for (const key of Object.keys(lower.limits) as Array<
        keyof typeof lower.limits
      >) {
        expect(higher.limits[key]).toBeGreaterThanOrEqual(lower.limits[key]);
      }
      const lowerQuota = lower.quotas.analysisDaily;
      const higherQuota = higher.quotas.analysisDaily;
      if (higherQuota !== null && lowerQuota !== null) {
        expect(higherQuota).toBeGreaterThanOrEqual(lowerQuota);
      }
    }
  });

  it('admin được quyền định giá của gói valued', () => {
    expect(effectivePermissions(UserRole.ADMIN, Plan.FREE)).toContain(
      'valuation:run',
    );
    expect(effectivePermissions(UserRole.USER, Plan.FREE)).not.toContain(
      'valuation:run',
    );
    expect(effectivePermissions(UserRole.USER, Plan.VALUED)).toContain(
      'valuation:run',
    );
  });

  it('quyền nhắn tin: user đọc và ghi, chỉ admin kiểm duyệt', () => {
    const user = effectivePermissions(UserRole.USER, Plan.FREE);
    expect(user).toContain('message:read');
    expect(user).toContain('message:write');
    expect(user).not.toContain('message:moderate');
    expect(effectivePermissions(UserRole.ADMIN, Plan.FREE)).toContain('message:moderate');
    expect(effectivePermissions(UserRole.GUEST, Plan.FREE)).not.toContain('message:read');
  });

  it('quyền góp ý: user gửi, chỉ admin quản lý', () => {
    expect(effectivePermissions(UserRole.USER, Plan.FREE)).toContain('feedback:write');
    expect(effectivePermissions(UserRole.USER, Plan.FREE)).not.toContain('feedback:manage');
    expect(effectivePermissions(UserRole.ADMIN, Plan.FREE)).toContain('feedback:manage');
    expect(effectivePermissions(UserRole.GUEST, Plan.FREE)).not.toContain('feedback:write');
  });

  it('quyền theo dõi: user đọc và ghi, khách không có', () => {
    const user = effectivePermissions(UserRole.USER, Plan.FREE);
    expect(user).toContain('follow:read');
    expect(user).toContain('follow:write');
    expect(effectivePermissions(UserRole.GUEST, Plan.FREE)).not.toContain('follow:write');
  });

  it('gói hết hạn được tính là free', () => {
    expect(effectivePlan(Plan.VALUED, Date.now() - 1000)).toBe(Plan.FREE);
    expect(effectivePlan(Plan.VALUED, Date.now() + 60_000)).toBe(Plan.VALUED);
  });
});
