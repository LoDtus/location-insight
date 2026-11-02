import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { NotificationEntity } from './entities/notification.entity.js';
import { NotificationsService } from './notification.service.js';

@Injectable()
export class SeedNotificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedNotificationService.name);

  constructor(
    private readonly notifications: NotificationsService,
    @InjectRepository(NotificationEntity)
    private readonly rows: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    const user = await this.users.findOne({ where: { email: 'user@location-insight.local' } });
    if (!user) return;
    const existing = await this.rows.count({ where: { userId: user.id } });
    if (existing > 0) return;
    await this.notifications.notify({
      userId: user.id,
      type: 'payment.succeeded',
      link: '/app/payments',
      params: { preview: 'Gói dùng thử đã được ghi nhận' },
      dedupeKey: 'seed:payment:user',
    });
    await this.notifications.notify({
      userId: user.id,
      type: 'security.new_login',
      link: '/app/profile',
      params: { preview: 'Trình duyệt trên máy này' },
      dedupeKey: 'seed:login:user',
    });
    this.logger.log('Đã tạo thông báo mẫu cho tài khoản người dùng.');
  }
}
