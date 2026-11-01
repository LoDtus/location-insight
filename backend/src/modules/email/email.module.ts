import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { EmailAdminService } from './email-admin.service.js';
import { EmailWorkerService } from './email-worker.service.js';
import { EmailAdminController, EmailController } from './email.controller.js';
import { EmailConfig } from './email.config.js';
import { EmailService } from './email.service.js';
import { EmailMessageEntity } from './entities/email-message.entity.js';
import { EmailPreferenceEntity } from './entities/email-preference.entity.js';
import { EmailSuppressionEntity } from './entities/email-suppression.entity.js';
import { EmailTemplateEntity } from './entities/email-template.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailTemplateEntity,
      EmailMessageEntity,
      EmailSuppressionEntity,
      EmailPreferenceEntity,
      UserEntity,
      AdminAuditLogEntity,
    ]),
  ],
  controllers: [EmailController, EmailAdminController],
  providers: [EmailConfig, EmailService, EmailAdminService, EmailWorkerService],
  exports: [EmailService],
})
export class EmailModule {}
