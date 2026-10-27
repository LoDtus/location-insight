import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ArticlesService } from './articles.service.js';

@Injectable()
export class ArticlesMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly articles: ArticlesService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.articles.promoteScheduled();
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
