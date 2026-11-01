import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscussionsService } from './discussions.service.js';

const HOUR = 60 * 60 * 1000;

@Injectable()
export class DiscussionsMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly discussions: DiscussionsService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.discussions.cleanup();
    }, HOUR);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
