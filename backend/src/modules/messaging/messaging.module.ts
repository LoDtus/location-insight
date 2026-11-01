import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowModule } from '../follow/follow.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { DiscussionPostEntity } from '../discussions/entities/discussion-post.entity.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { ConversationEntity } from './entities/conversation.entity.js';
import { ConversationParticipantEntity } from './entities/conversation-participant.entity.js';
import { MessageAttachmentEntity } from './entities/message-attachment.entity.js';
import { MessageReactionEntity } from './entities/message-reaction.entity.js';
import { MessageReportEntity } from './entities/message-report.entity.js';
import { MessageEntity } from './entities/message.entity.js';
import { MessagingPreferenceEntity } from './entities/messaging-preference.entity.js';
import { UserBlockEntity } from './entities/user-block.entity.js';
import { MessagingAccessService } from './messaging-access.service.js';
import { MessagingAdminController } from './messaging-admin.controller.js';
import { MessagingAttachmentsService } from './messaging-attachments.service.js';
import { MessagingConversationsService } from './messaging-conversations.service.js';
import { MessagingEventsService } from './messaging-events.service.js';
import { MessagingMaintenanceService } from './messaging-maintenance.service.js';
import { MessagingMessagesService } from './messaging-messages.service.js';
import { MessagingPresenceService } from './messaging-presence.service.js';
import { MessagingPresenterService } from './messaging-presenter.service.js';
import { MessagingRateLimitService } from './messaging-rate-limit.service.js';
import { MessagingRealtimeService } from './messaging-realtime.service.js';
import { MessagingSafetyService } from './messaging-safety.service.js';
import { SeedMessagingService } from './seed-messaging.service.js';
import { MessagingSchemaService } from './messaging-schema.service.js';
import { MessagingController } from './messaging.controller.js';

@Module({
  imports: [
    AuthModule,
    FollowModule,
    TypeOrmModule.forFeature([
      ConversationEntity,
      ConversationParticipantEntity,
      MessageEntity,
      MessageAttachmentEntity,
      MessageReactionEntity,
      MessageReportEntity,
      MessagingPreferenceEntity,
      UserBlockEntity,
      UserEntity,
      DiscussionPostEntity,
      AdminAuditLogEntity,
    ]),
  ],
  controllers: [MessagingController, MessagingAdminController],
  providers: [
    MessagingAccessService,
    MessagingRateLimitService,
    MessagingEventsService,
    MessagingPresenceService,
    MessagingPresenterService,
    MessagingConversationsService,
    MessagingMessagesService,
    MessagingAttachmentsService,
    MessagingSafetyService,
    MessagingRealtimeService,
    MessagingMaintenanceService,
    MessagingSchemaService,
    SeedMessagingService,
  ],
})
export class MessagingModule {}
