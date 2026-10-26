import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

type RequestUser = {
  user?: { sub?: string; id?: string };
  ips?: string[];
  ip?: string;
};

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    const request = context.switchToHttp().getRequest<RequestUser>();
    const userId = request.user?.sub || request.user?.id;
    const tracker = userId ? `user:${userId}` : `ip:${suffix}`;
    return `${tracker}:${name}`;
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ips = Array.isArray(req.ips) ? req.ips : [];
    const ip = ips.length > 0 ? ips[0] : req.ip;
    return typeof ip === 'string' && ip ? ip : 'unknown';
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    const retryAfterMs =
      throttlerLimitDetail.timeToBlockExpire ||
      throttlerLimitDetail.timeToExpire ||
      throttlerLimitDetail.ttl;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    const response = res as {
      header?: (name: string, value: string) => void;
      setHeader?: (name: string, value: string) => void;
    };

    if (typeof response.header === 'function') {
      response.header('Retry-After', String(retryAfterSeconds));
    } else if (typeof response.setHeader === 'function') {
      response.setHeader('Retry-After', String(retryAfterSeconds));
    }

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
