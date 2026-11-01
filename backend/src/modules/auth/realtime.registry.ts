import { Injectable } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

export interface RealtimeContext {
  socket: Socket;
  userId: string;
  sid: string;
}

type ContextHandler = (context: RealtimeContext) => void | Promise<void>;
type DisconnectHandler = (
  context: RealtimeContext,
  remainingSockets: number,
) => void | Promise<void>;
type EventHandler = (
  context: RealtimeContext,
  payload: unknown,
) => void | Promise<void>;

/**
 * Cầu nối giữa RealtimeGateway (auth) và các module nghiệp vụ như messaging,
 * để module nghiệp vụ đăng ký xử lý mà không làm gateway phụ thuộc ngược vào chúng.
 */
@Injectable()
export class RealtimeRegistry {
  server: Server | null = null;
  private readonly connectHandlers: ContextHandler[] = [];
  private readonly pingHandlers: ContextHandler[] = [];
  private readonly disconnectHandlers: DisconnectHandler[] = [];
  private readonly eventHandlers = new Map<string, EventHandler[]>();

  onConnect(handler: ContextHandler): void {
    this.connectHandlers.push(handler);
  }

  onPing(handler: ContextHandler): void {
    this.pingHandlers.push(handler);
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.push(handler);
  }

  onEvent(name: string, handler: EventHandler): void {
    const list = this.eventHandlers.get(name) ?? [];
    list.push(handler);
    this.eventHandlers.set(name, list);
  }

  async runConnect(context: RealtimeContext): Promise<void> {
    for (const handler of this.connectHandlers) await handler(context);
  }

  async runPing(context: RealtimeContext): Promise<void> {
    for (const handler of this.pingHandlers) await handler(context);
  }

  async runDisconnect(context: RealtimeContext, remaining: number): Promise<void> {
    for (const handler of this.disconnectHandlers) await handler(context, remaining);
  }

  async runEvent(name: string, context: RealtimeContext, payload: unknown): Promise<void> {
    for (const handler of this.eventHandlers.get(name) ?? []) {
      await handler(context, payload);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
