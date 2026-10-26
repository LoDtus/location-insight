import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AUTH_LIMITS } from './auth.constants.js';
import { SessionService } from './session.service.js';

@Injectable()
export class SessionMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SessionMaintenanceService.name);
  private reconcileTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly sessions: SessionService) {}

  onModuleInit(): void {
    this.reconcileTimer = setInterval(() => {
      void this.sessions.reconcile().catch((error: unknown) => {
        this.logger.warn(`Đối soát phiên lỗi: ${String(error)}`);
      });
    }, AUTH_LIMITS.reconcileIntervalMs);
    this.cleanupTimer = setInterval(() => {
      void this.sessions.cleanup().catch((error: unknown) => {
        this.logger.warn(`Dọn phiên lỗi: ${String(error)}`);
      });
    }, AUTH_LIMITS.cleanupIntervalMs);
    this.reconcileTimer.unref();
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}
