import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { DiscussionsAdminController } from './discussions-admin.controller.js';
import { DiscussionsMaintenanceService } from './discussions-maintenance.service.js';
import { DiscussionsController } from './discussions.controller.js';
import { DiscussionsService } from './discussions.service.js';
import { SeedDiscussionService } from './seed-discussion.service.js';
import { DiscussionLikeEntity } from './entities/discussion-like.entity.js';
import { DiscussionMediaEntity } from './entities/discussion-media.entity.js';
import { DiscussionPostEntity } from './entities/discussion-post.entity.js';
import { DiscussionReportEntity } from './entities/discussion-report.entity.js';
import { DiscussionTopicEntity } from './entities/discussion-topic.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiscussionTopicEntity,
      DiscussionPostEntity,
      DiscussionMediaEntity,
      DiscussionLikeEntity,
      DiscussionReportEntity,
      UserEntity,
      AdminAuditLogEntity,
    ]),
  ],
  controllers: [DiscussionsController, DiscussionsAdminController],
  providers: [
    DiscussionsService,
    DiscussionsMaintenanceService,
    SeedDiscussionService,
  ],
})
export class DiscussionsModule {}
