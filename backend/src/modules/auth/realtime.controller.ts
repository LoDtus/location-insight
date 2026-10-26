import { Controller, Post, Req } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthenticatedOnly } from '../../common/decorators/access.decorator.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import type { RequestWithPrincipal } from './auth.guard.js';
import { AUTH_LIMITS, REDIS_KEYS } from './auth.constants.js';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly redis: RedisService) {}

  @AuthenticatedOnly()
  @Post('ticket')
  async ticket(@Req() request: RequestWithPrincipal) {
    const principal = request.principal;
    const ticket = randomBytes(24).toString('base64url');
    await this.redis
      .getClient()
      .set(
        REDIS_KEYS.wsTicket(ticket),
        `${principal?.userId}:${principal?.sessionId}`,
        'EX',
        AUTH_LIMITS.wsTicketTtlSeconds,
      );
    return { ticket, expiresIn: AUTH_LIMITS.wsTicketTtlSeconds };
  }
}
