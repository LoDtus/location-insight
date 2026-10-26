import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { AdminController } from './admin.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { AuthzCacheService } from './authz-cache.service.js';
import { EntitlementsController } from './entitlements.controller.js';
import { AdminAuditLogEntity } from './entities/admin-audit-log.entity.js';
import { CreditLedgerEntryEntity } from './entities/credit-ledger-entry.entity.js';
import { SubscriptionEntity } from './entities/subscription.entity.js';
import { PermissionsGuard } from './permissions.guard.js';
import { PolicyService } from './policy.service.js';
import { QuotaInterceptor } from './quota.interceptor.js';
import { QuotaService } from './quota.service.js';
import { RouteInventoryService } from './route-inventory.service.js';

@Module({
  imports: [
    DiscoveryModule,
    TypeOrmModule.forFeature([
      UserEntity,
      SubscriptionEntity,
      CreditLedgerEntryEntity,
      AdminAuditLogEntity,
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [EntitlementsController, AdminController],
  providers: [
    PolicyService,
    AuthzCacheService,
    QuotaService,
    AdminUsersService,
    RouteInventoryService,
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: QuotaInterceptor },
  ],
  exports: [PolicyService, AuthzCacheService, QuotaService, AdminUsersService],
})
export class RbacModule {}
