import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { tooMany, unavailable } from './messaging-errors.js';
import {
  MESSAGING_KEYS,
  MESSAGING_RATE,
  MessagingRateName,
} from './messaging.constants.js';

const SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {count, ttl}
`;

@Injectable()
export class MessagingRateLimitService {
  constructor(private readonly redis: RedisService) {}

  /** Giới hạn khi ghi: Redis lỗi thì từ chối (503), không mở không giới hạn. */
  async consume(name: MessagingRateName, scope: string): Promise<void> {
    const rule = MESSAGING_RATE[name];
    let result: [number, number];
    try {
      result = (await this.redis
        .getClient()
        .eval(SCRIPT, 1, MESSAGING_KEYS.rate(name, scope), String(rule.window))) as [
        number,
        number,
      ];
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      unavailable();
    }
    const [count, ttl] = result;
    if (count > rule.max) tooMany(Math.max(1, ttl));
  }

  /** Dùng cho tín hiệu không quan trọng (typing, đã đọc): vượt hoặc lỗi thì bỏ qua im lặng. */
  async allow(name: MessagingRateName, scope: string): Promise<boolean> {
    try {
      await this.consume(name, scope);
      return true;
    } catch {
      return false;
    }
  }
}
