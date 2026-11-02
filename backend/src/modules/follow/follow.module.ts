import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { UserFollowStatsEntity } from './entities/user-follow-stats.entity.js';
import { UserFollowEntity } from './entities/user-follow.entity.js';
import { FollowController } from './follow.controller.js';
import { FollowService } from './follow.service.js';
import { SeedFollowService } from './seed-follow.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserFollowEntity, UserFollowStatsEntity, UserEntity]), EmailModule, NotificationModule],
  controllers: [FollowController],
  providers: [FollowService, SeedFollowService],
  exports: [FollowService],
})
export class FollowModule {}
