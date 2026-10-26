import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import {
  ADMIN_EFFECTIVE_PLAN,
  effectivePermissions,
  effectivePlan,
  PLAN_ENTITLEMENTS,
  RECENT_AUTH_SECONDS,
  REQUIRES_RECENT_AUTH,
  RESOURCE_RULES,
} from './authorization.config.js';
import {
  Permission,
  Plan,
  Principal,
  QuotaName,
  UserRole,
} from './authorization.types.js';

@Injectable()
export class PolicyService {
  permissionsOf(principal: Principal): Permission[] {
    return effectivePermissions(principal.role, this.planOf(principal));
  }

  planOf(principal: Principal): Plan {
    if (principal.role === UserRole.ADMIN) return ADMIN_EFFECTIVE_PLAN;
    return effectivePlan(principal.plan, principal.planUntil);
  }

  has(principal: Principal, permission: Permission): boolean {
    return this.permissionsOf(principal).includes(permission);
  }

  quotaLimit(principal: Principal, name: QuotaName): number | null {
    if (principal.role === UserRole.ADMIN) return null;
    return PLAN_ENTITLEMENTS[this.planOf(principal)].quotas[name];
  }

  limitsOf(principal: Principal) {
    const plan =
      principal.role === UserRole.ADMIN
        ? ADMIN_EFFECTIVE_PLAN
        : this.planOf(principal);
    return PLAN_ENTITLEMENTS[plan].limits;
  }

  needsRecentAuth(
    permissions: readonly Permission[],
    explicit: boolean,
  ): boolean {
    return (
      explicit ||
      permissions.some((item) => REQUIRES_RECENT_AUTH.includes(item))
    );
  }

  assertRecentAuth(principal: Principal): void {
    const authTime = principal.authTime;
    const fresh =
      authTime !== null && Date.now() - authTime <= RECENT_AUTH_SECONDS * 1000;
    if (!fresh) {
      throw new BusinessException(
        ErrorCode.REAUTH_REQUIRED,
        'Cần xác thực lại trước khi tiếp tục.',
        null,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  assertCanAffectUser(
    actor: Principal,
    target: { id: string; role: string },
  ): void {
    if (target.role === UserRole.ADMIN || target.id === actor.userId) {
      throw new BusinessException(
        ErrorCode.PERMISSION_DENIED,
        'Không có quyền thực hiện thao tác này.',
        null,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  assertAccountDeletion(role: string, adminCount: number): void {
    if (role === UserRole.ADMIN && adminCount <= 1) {
      throw new BusinessException(
        ErrorCode.PERMISSION_DENIED,
        'Không có quyền thực hiện thao tác này.',
        null,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  assertOwner(
    principal: Principal,
    permission: Permission,
    resource: Record<string, unknown> | null,
  ): void {
    const rule = RESOURCE_RULES[permission];
    if (!rule) return;
    const owner = resource?.[rule.ownerField];
    if (owner && owner === principal.userId) return;
    if (rule.orPermission && this.has(principal, rule.orPermission)) return;

    if (rule.denyAs === 404 || !resource) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Không tìm thấy dữ liệu.',
        null,
        HttpStatus.NOT_FOUND,
      );
    }
    throw new BusinessException(
      ErrorCode.PERMISSION_DENIED,
      'Không có quyền thực hiện thao tác này.',
      null,
      HttpStatus.FORBIDDEN,
    );
  }
}
