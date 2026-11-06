import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscussionsService } from './discussions.service.js';

const HOUR = 60 * 60 * 1000;
/** Bài hẹn giờ được đăng trễ tối đa chừng này. */
const PUBLISH_EVERY_MS = 30 * 1000;

@Injectable()
export class DiscussionsMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private publisher: NodeJS.Timeout | null = null;

  constructor(private readonly discussions: DiscussionsService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.discussions.cleanup();
    }, HOUR);
    this.timer.unref();
    this.publisher = setInterval(() => {
      void this.discussions.publishDue().catch(() => undefined);
    }, PUBLISH_EVERY_MS);
    this.publisher.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.publisher) clearInterval(this.publisher);
  }
}
