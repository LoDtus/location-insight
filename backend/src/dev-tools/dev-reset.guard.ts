import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { forwardedIps, isPrivateOrLoopbackIp } from './dev-reset.network.js';
import { evaluateDevResetPolicy } from './dev-reset.policy.js';

export const DEV_RESET_TOKEN_HEADER = 'x-dev-reset-token';

function sameSecret(expected: string, received: string | undefined): boolean {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Bảo vệ `POST /dev/reset`. Mọi lỗi điều kiện môi trường trả 404 (như không tồn tại);
 * lỗi xác thực trả 403 với thông điệp chung, không nói rõ lớp nào chặn.
 */
@Injectable()
export class DevResetGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const policy = evaluateDevResetPolicy(process.env);
    if (!policy.allowed) throw new NotFoundException();

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers[DEV_RESET_TOKEN_HEADER];
    const received = Array.isArray(token) ? token[0] : token;
    const peers = [request.ip, ...forwardedIps(request.headers['x-forwarded-for'])];
    const fromBrowser = Boolean(request.headers.origin);

    if (
      fromBrowser ||
      !sameSecret(process.env.DEV_RESET_TOKEN ?? '', received) ||
      !peers.every((peer) => isPrivateOrLoopbackIp(peer))
    ) {
      throw new ForbiddenException('Không được phép.');
    }
    return true;
  }
}
