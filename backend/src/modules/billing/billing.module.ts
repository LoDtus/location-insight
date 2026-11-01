import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import { CreditLedgerEntryEntity } from '../rbac/entities/credit-ledger-entry.entity.js';
import { SubscriptionEntity } from '../rbac/entities/subscription.entity.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { BillingAdminController } from './billing-admin.controller.js';
import { BillingAdminService } from './billing-admin.service.js';
import { BillingConfig } from './billing.config.js';
import { BillingController } from './billing.controller.js';
import { BillingMaintenanceService } from './billing-maintenance.service.js';
import { BillingService } from './billing.service.js';
import { BillingNoticeEntity } from './entities/billing-notice.entity.js';
import { PaymentOrderEntity } from './entities/payment-order.entity.js';
import { PaymentTransactionEntity } from './entities/payment-transaction.entity.js';
import { SepayWebhookController } from './sepay-webhook.controller.js';
import { UserDirectoryService } from './user-directory.service.js';
import { SeedBillingService } from './seed-billing.service.js';
import { SepayWebhookService } from './sepay-webhook.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentOrderEntity,
      PaymentTransactionEntity,
      BillingNoticeEntity,
      SubscriptionEntity,
      CreditLedgerEntryEntity,
      UserEntity,
      AdminAuditLogEntity,
    ]),
    RbacModule,
  ],
  controllers: [
    BillingController,
    SepayWebhookController,
    BillingAdminController,
  ],
  providers: [
    BillingConfig,
    BillingService,
    SepayWebhookService,
    BillingAdminService,
    UserDirectoryService,
    BillingMaintenanceService,
    SeedBillingService,
  ],
})
export class BillingModule {}
