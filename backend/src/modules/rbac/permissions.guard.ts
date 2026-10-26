import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import {
  AUTHENTICATED_KEY,
  PERMISSIONS_KEY,
  PUBLIC_KEY,
  RECENT_AUTH_KEY,
} from '../../common/decorators/access.decorator.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { RequestWithPrincipal } from '../auth/auth.guard.js';
import { AuthConfig } from '../auth/auth.config.js';
import { clientIp } from '../auth/auth.constants.js';
import { ADMIN_PERMISSIONS, lowestPlanWith } from './authorization.config.js';
import {
  Permission,
  Plan,
  Principal,
  UserRole,
} from './authorization.types.js';
import { PolicyService } from './policy.service.js';

const GUEST: Principal = {
  userId: null,
  role: UserRole.GUEST,
  status: null,
  plan: Plan.FREE,
  planUntil: null,
  sessionId: null,
  authTime: null,
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PolicyService,
    private readonly authConfig: AuthConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = request.principal ?? GUEST;
    request.principal = principal;

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const authenticated = this.reflector.getAllAndOverride<boolean>(
      AUTHENTICATED_KEY,
      [context.getHandler(), context.getClass()],
    );
    const permissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const recent = this.reflector.getAllAndOverride<boolean>(RECENT_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic && !authenticated && permissions.length === 0) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        'Route chưa khai báo quyền.',
        null,
        HttpStatus.FORBIDDEN,
      );
    }
    if (!isPublic && !principal.userId) {
      throw new BusinessException(
        ErrorCode.UNAUTHENTICATED,
        'Cần đăng nhập.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const missing = permissions.filter(
      (permission) => !this.policy.has(principal, permission),
    );
    if (missing.length) {
      const requiredPlan = principal.userId ? lowestPlanWith(missing[0]) : null;
      if (requiredPlan) {
        throw new BusinessException(
          ErrorCode.PLAN_REQUIRED,
          'Cần gói cao hơn để dùng chức năng này.',
          { requiredPlan },
          HttpStatus.FORBIDDEN,
        );
      }
      throw new BusinessException(
        ErrorCode.PERMISSION_DENIED,
        'Không có quyền thực hiện thao tác này.',
        null,
        HttpStatus.FORBIDDEN,
      );
    }

    if (
      permissions.some((permission) =>
        (ADMIN_PERMISSIONS as readonly Permission[]).includes(permission),
      )
    ) {
      this.assertAdminNetwork(request);
    }
    if (this.policy.needsRecentAuth(permissions, Boolean(recent))) {
      this.policy.assertRecentAuth(principal);
    }
    return true;
  }

  private assertAdminNetwork(request: RequestWithPrincipal): void {
    const cidrs = this.authConfig.adminCidrs;
    if (!cidrs.length) return;
    const ip = clientIp(request.ip);
    if (!cidrs.some((cidr) => ipMatches(ip, cidr))) {
      throw new BusinessException(
        ErrorCode.PERMISSION_DENIED,
        'Không có quyền thực hiện thao tác này.',
        null,
        HttpStatus.FORBIDDEN,
      );
    }
  }
}

function ipMatches(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;
  const [range, bitsText] = cidr.split('/');
  const bits = Number(bitsText);
  if (!range || Number.isNaN(bits) || ip.includes(':') || range.includes(':')) {
    return false;
  }
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4(ip) & mask) === (ipv4(range) & mask);
}

function ipv4(value: string): number {
  return value
    .split('.')
    .reduce((acc, part) => ((acc << 8) + Number(part)) >>> 0, 0);
}
