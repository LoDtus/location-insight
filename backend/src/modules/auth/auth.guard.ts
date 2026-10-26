import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import {
  AUTHENTICATED_KEY,
  PERMISSIONS_KEY,
  PUBLIC_KEY,
} from '../../common/decorators/access.decorator.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { effectivePlan } from '../rbac/authorization.config.js';
import {
  Permission,
  Plan,
  Principal,
  UserRole,
} from '../rbac/authorization.types.js';
import { SessionVerifierService } from './session-verifier.service.js';
import { TokenService } from './token.service.js';

export type RequestWithPrincipal = Request & { principal?: Principal };

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
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly verifier: SessionVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
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

    if (isPublic) {
      request.principal = GUEST;
      return true;
    }

    const header = request.header('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw new BusinessException(
        ErrorCode.UNAUTHENTICATED,
        'Cần đăng nhập.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const claims = await this.tokens.verifyAccessToken(token);
    const verified = await this.verifier.verify(
      claims.sid,
      claims.sub,
      claims.iat,
    );
    const plan = effectivePlan(
      verified.authz.plan,
      verified.authz.planUntil || null,
    );
    request.principal = {
      userId: verified.userId,
      role:
        verified.authz.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER,
      status: verified.authz.status,
      plan,
      planUntil: verified.authz.planUntil || null,
      sessionId: verified.sessionId,
      authTime: verified.authTime,
    };

    if (!authenticated && permissions.length === 0) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        'Route chưa khai báo quyền.',
        null,
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
