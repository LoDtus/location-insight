import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { NotificationPreferenceEntity } from './entities/notification-preference.entity.js';
import { NotificationEntity } from './entities/notification.entity.js';
import { PushOutboxEntity } from './entities/push-outbox.entity.js';
import { PushSubscriptionEntity } from './entities/push-subscription.entity.js';
import { NotificationController } from './notification.controller.js';
import { NotificationEventsService } from './notification-events.service.js';
import { NotificationPushService } from './notification-push.service.js';
import { SeedNotificationService } from './seed-notification.service.js';
import { NotificationsService } from './notification.service.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationPreferenceEntity,
      PushSubscriptionEntity,
      PushOutboxEntity,
      UserEntity,
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationsService, NotificationEventsService, NotificationPushService, SeedNotificationService],
  exports: [NotificationsService, NotificationPushService],
})
export class NotificationModule {}
