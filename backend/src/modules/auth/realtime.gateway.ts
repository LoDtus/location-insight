import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { REDIS_CHANNELS, REDIS_KEYS } from './auth.constants.js';

const socketPath = `/${process.env.GLOBAL_PREFIX || 'api/v1'}/realtime`;

@WebSocketGateway({
  path: socketPath,
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly redis: RedisService) {}

  async afterInit(): Promise<void> {
    const subscriber = this.redis.getClient().duplicate();
    await subscriber.subscribe(
      REDIS_CHANNELS.sessionRevoked,
      REDIS_CHANNELS.authzChanged,
    );
    subscriber.on('message', (channel, message) => {
      const payload = JSON.parse(message) as {
        sid?: string;
        userId?: string;
        reason?: string;
      };
      if (channel === REDIS_CHANNELS.sessionRevoked && payload.sid) {
        this.server.to(`sid:${payload.sid}`).emit('session.revoked', {
          type: 'session.revoked',
          reason: payload.reason,
        });
        for (const socket of this.server.sockets.sockets.values()) {
          if (socket.data.sid === payload.sid) socket.disconnect(true);
        }
      }
      if (channel === REDIS_CHANNELS.authzChanged && payload.userId) {
        this.server.to(`user:${payload.userId}`).emit('authz.changed', {
          type: 'authz.changed',
        });
      }
    });

    const timer = setInterval(() => {
      void this.recheck();
    }, 60_000);
    timer.unref();
  }

  async handleConnection(client: Socket): Promise<void> {
    const ticket = String(client.handshake.query.ticket || '');
    const value = ticket
      ? await this.redis.getClient().getdel(REDIS_KEYS.wsTicket(ticket))
      : null;
    if (!value) {
      client.disconnect(true);
      return;
    }
    const separator = value.indexOf(':');
    const userId = value.slice(0, separator);
    const sid = value.slice(separator + 1);
    client.data = { userId, sid };
    await client.join(`sid:${sid}`);
    await client.join(`user:${userId}`);
    this.logger.debug(`Socket ${sid} đã nối`);
  }

  @SubscribeMessage('ping')
  ping(): { type: 'pong' } {
    return { type: 'pong' };
  }

  private async recheck(): Promise<void> {
    for (const socket of this.server.sockets.sockets.values()) {
      const sid = socket.data.sid as string | undefined;
      if (!sid) continue;
      const active = await this.redis
        .getClient()
        .exists(REDIS_KEYS.sessionActive(sid));
      if (!active) socket.disconnect(true);
    }
  }
}
