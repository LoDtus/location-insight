import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { FeedbackMediaEntity } from './entities/feedback-media.entity.js';
import { FeedbackReplyEntity } from './entities/feedback-reply.entity.js';
import { FeedbackEntity } from './entities/feedback.entity.js';
import { FeedbackAdminController, FeedbackController } from './feedback.controller.js';
import { FeedbackMaintenanceService } from './feedback-maintenance.service.js';
import { FeedbackService } from './feedback.service.js';
import { SeedFeedbackService } from './seed-feedback.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeedbackEntity,
      FeedbackMediaEntity,
      FeedbackReplyEntity,
      UserEntity,
      AdminAuditLogEntity,
    ]),
    EmailModule,
    NotificationModule,
  ],
  controllers: [FeedbackController, FeedbackAdminController],
  providers: [FeedbackService, FeedbackMaintenanceService, SeedFeedbackService],
})
export class FeedbackModule {}
