import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FeedbackService } from './feedback.service.js';

@Injectable()
export class FeedbackMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly feedback: FeedbackService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.feedback.cleanup().catch(() => undefined);
    }, 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
