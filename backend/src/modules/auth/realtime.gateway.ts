import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { REDIS_CHANNELS, REDIS_KEYS } from './auth.constants.js';
import { RealtimeContext, RealtimeRegistry } from './realtime.registry.js';

// Không đặt dưới /realtime: engine.io chặn mọi URL bắt đầu bằng path, làm mất POST /realtime/ticket.
const socketPath = `/${process.env.GLOBAL_PREFIX || 'api/v1'}/ws`;
const DEFAULT_ORIGINS = ['http://localhost:22360', 'http://127.0.0.1:22360'];

const SOCKETS_PER_USER = 5;
const EVENTS_PER_SECOND = 10;
const SOCKET_STALE_SECONDS = 90;
const EVICT_CHANNEL = 'events:realtime:evict';

function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  const list = raw
    ? raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : DEFAULT_ORIGINS;
  return list.length ? list : DEFAULT_ORIGINS;
}

function originAllowed(origin: string | undefined): boolean {
  return !origin || allowedOrigins().includes(origin);
}

const socketsKey = (userId: string): string => `msg:ws:sockets:${userId}`;

@WebSocketGateway({
  path: socketPath,
  transports: ['websocket'],
  maxHttpBufferSize: 16 * 1024,
  cors: { origin: (origin: string | undefined, done: (error: Error | null, ok?: boolean) => void) => done(null, originAllowed(origin)), credentials: true },
  allowRequest: (
    request: { headers: { origin?: string } },
    done: (error: string | null | undefined, success: boolean) => void,
  ) => {
    if (originAllowed(request.headers.origin)) done(null, true);
    else done('origin_not_allowed', false);
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly redis: RedisService,
    private readonly registry: RealtimeRegistry,
  ) {}

  async afterInit(): Promise<void> {
    this.registry.server = this.server;
    const subscriber = this.redis.getClient().duplicate();
    await subscriber.subscribe(
      REDIS_CHANNELS.sessionRevoked,
      REDIS_CHANNELS.authzChanged,
      EVICT_CHANNEL,
    );
    subscriber.on('message', (channel, message) => {
      let payload: {
        sid?: string;
        userId?: string;
        reason?: string;
        socketIds?: string[];
      };
      try {
        payload = JSON.parse(message) as typeof payload;
      } catch {
        return;
      }
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
      if (channel === EVICT_CHANNEL && payload.socketIds) {
        for (const id of payload.socketIds) {
          const socket = this.server.sockets.sockets.get(id);
          if (socket) this.closeWith(socket, 4403);
        }
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
      this.closeWith(client, 4408);
      return;
    }
    const separator = value.indexOf(':');
    const userId = value.slice(0, separator);
    const sid = value.slice(separator + 1);
    client.data = { userId, sid };
    await client.join(`sid:${sid}`);
    await client.join(`user:${userId}`);

    this.limitEventRate(client);
    await this.registerSocket(userId, client.id);
    await this.registry.runConnect(this.context(client)).catch((error: unknown) => {
      this.logger.warn(`Hook connect lỗi: ${error instanceof Error ? error.message : 'không rõ'}`);
    });
    this.logger.debug(`Socket ${client.id} đã nối`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const context = this.contextOrNull(client);
    if (!context) return;
    const remaining = await this.unregisterSocket(context.userId, client.id);
    await this.registry.runDisconnect(context, remaining).catch(() => undefined);
  }

  @SubscribeMessage('ping')
  async ping(
    @ConnectedSocket() client: Socket,
  ): Promise<{ type: 'pong' }> {
    const context = this.contextOrNull(client);
    if (context) {
      await this.redis
        .getClient()
        .zadd(socketsKey(context.userId), 'XX', Date.now(), client.id)
        .catch(() => undefined);
      await this.registry.runPing(context).catch(() => undefined);
    }
    return { type: 'pong' };
  }

  @SubscribeMessage('presence.visible')
  async presence(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const context = this.contextOrNull(client);
    if (!context) return;
    await this.registry.runEvent('presence.visible', context, payload).catch(() => undefined);
  }

  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const context = this.contextOrNull(client);
    if (!context) return;
    await this.registry.runEvent('typing', context, payload).catch(() => undefined);
  }

  private context(client: Socket): RealtimeContext {
    return {
      socket: client,
      userId: client.data.userId as string,
      sid: client.data.sid as string,
    };
  }

  private contextOrNull(client: Socket): RealtimeContext | null {
    const data = client.data as { userId?: string; sid?: string } | undefined;
    if (!data?.userId || !data.sid) return null;
    return this.context(client);
  }

  private closeWith(client: Socket, code: number): void {
    client.emit('realtime.close', { type: 'realtime.close', code });
    client.disconnect(true);
  }

  /** Tối đa 10 sự kiện mỗi giây mỗi socket; quá thì đóng 4429. */
  private limitEventRate(client: Socket): void {
    let windowStart = Date.now();
    let count = 0;
    client.use((_packet, next) => {
      const now = Date.now();
      if (now - windowStart >= 1000) {
        windowStart = now;
        count = 0;
      }
      count += 1;
      if (count > EVENTS_PER_SECOND) {
        this.closeWith(client, 4429);
        return;
      }
      next();
    });
  }

  /** Mỗi người tối đa 5 socket; vượt thì đóng socket lâu không hoạt động nhất (4403). */
  private async registerSocket(userId: string, socketId: string): Promise<void> {
    const client = this.redis.getClient();
    const key = socketsKey(userId);
    try {
      const now = Date.now();
      await client.zremrangebyscore(key, '-inf', now - SOCKET_STALE_SECONDS * 1000);
      await client.zadd(key, now, socketId);
      await client.expire(key, SOCKET_STALE_SECONDS * 2);
      const count = await client.zcard(key);
      if (count > SOCKETS_PER_USER) {
        const excess = count - SOCKETS_PER_USER;
        const oldest = await client.zrange(key, 0, excess - 1);
        const victims = oldest.filter((id) => id !== socketId);
        if (victims.length) {
          await client.zrem(key, ...victims);
          await client.publish(EVICT_CHANNEL, JSON.stringify({ socketIds: victims }));
        }
      }
    } catch (error) {
      this.logger.warn(`Không ghi được danh sách socket: ${error instanceof Error ? error.message : 'không rõ'}`);
    }
  }

  private async unregisterSocket(userId: string, socketId: string): Promise<number> {
    const client = this.redis.getClient();
    try {
      await client.zrem(socketsKey(userId), socketId);
      return await client.zcard(socketsKey(userId));
    } catch {
      return 1;
    }
  }

  /** Kiểm tra phiên mỗi 60 giây: gom theo sid và dùng một pipeline. */
  private async recheck(): Promise<void> {
    const bySid = new Map<string, Socket[]>();
    for (const socket of this.server.sockets.sockets.values()) {
      const sid = socket.data.sid as string | undefined;
      if (!sid) continue;
      const list = bySid.get(sid) ?? [];
      list.push(socket);
      bySid.set(sid, list);
    }
    if (!bySid.size) return;
    const sids = [...bySid.keys()];
    try {
      const pipeline = this.redis.getClient().pipeline();
      for (const sid of sids) pipeline.exists(REDIS_KEYS.sessionActive(sid));
      const results = (await pipeline.exec()) ?? [];
      results.forEach(([error, active], index) => {
        if (error || active) return;
        for (const socket of bySid.get(sids[index] as string) ?? []) {
          socket.disconnect(true);
        }
      });
    } catch (error) {
      this.logger.warn(`Recheck phiên lỗi: ${error instanceof Error ? error.message : 'không rõ'}`);
    }
  }
}
