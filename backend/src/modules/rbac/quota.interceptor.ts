import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { Observable, from, switchMap, tap } from 'rxjs';
import { QUOTA_KEY } from '../../common/decorators/access.decorator.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { RequestWithPrincipal } from '../auth/auth.guard.js';
import { QuotaName, UserRole } from './authorization.types.js';
import { PolicyService } from './policy.service.js';
import { QuotaService } from './quota.service.js';

@Injectable()
export class QuotaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PolicyService,
    private readonly quota: QuotaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const name = this.reflector.get<QuotaName | undefined>(
      QUOTA_KEY,
      context.getHandler(),
    );
    if (!name) return next.handle();

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = request.principal;
    if (!principal?.userId || principal.role === UserRole.ADMIN)
      return next.handle();

    const requestId = request.header('x-request-id') || randomUUID();
    const limit = this.quota.applyBudget(
      this.policy.quotaLimit(principal, name),
    );

    return from(this.quota.reserve(principal.userId, requestId, limit)).pipe(
      switchMap((reservation) => {
        if (!reservation.ok) {
          const retryAfter = Math.max(
            1,
            Math.ceil(
              (new Date(reservation.resetAt).getTime() - Date.now()) / 1000,
            ),
          );
          context
            .switchToHttp()
            .getResponse()
            .setHeader('Retry-After', retryAfter);
          throw new BusinessException(
            ErrorCode.DAILY_QUOTA_EXCEEDED,
            'Đã hết lượt trong ngày.',
            { resetAt: reservation.resetAt },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (limit === null) return next.handle();
        return next.handle().pipe(
          tap({
            error: () => {
              void this.quota.release(
                principal.userId as string,
                requestId,
                reservation.dayKey,
              );
            },
          }),
        );
      }),
    );
  }
}
