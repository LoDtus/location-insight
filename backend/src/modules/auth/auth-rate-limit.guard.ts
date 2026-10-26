import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  RATE_LIMIT_KEY,
  AuthRateLimitAction,
} from '../../common/decorators/access.decorator.js';
import { clientIp } from './auth.constants.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limits: AuthRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<
      AuthRateLimitAction | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);
    if (!action || context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    await this.limits.consumeIp(action, clientIp(request.ip));
    if (action === 'reset') {
      const email = (request.body as { email?: string } | undefined)?.email;
      if (typeof email === 'string' && email) {
        await this.limits.consumeResetEmail(email);
      }
    }
    return true;
  }
}
