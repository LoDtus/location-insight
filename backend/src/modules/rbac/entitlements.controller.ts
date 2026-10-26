import { Controller, Get, Req } from '@nestjs/common';
import { AuthenticatedOnly } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { AdminUsersService } from './admin-users.service.js';
import { PolicyService } from './policy.service.js';
import { QuotaService } from './quota.service.js';
import { nextQuotaReset } from './quota-time.js';

@Controller('me')
export class EntitlementsController {
  constructor(
    private readonly policy: PolicyService,
    private readonly quota: QuotaService,
    private readonly admin: AdminUsersService,
  ) {}

  @AuthenticatedOnly()
  @Get('entitlements')
  async entitlements(@Req() request: RequestWithPrincipal) {
    const principal = request.principal!;
    const plan = this.policy.planOf(principal);
    const limits = this.policy.limitsOf(principal);
    const dailyLimit = this.quota.applyBudget(
      this.policy.quotaLimit(principal, 'analysisDaily'),
    );
    const used = principal.userId ? await this.quota.used(principal.userId) : 0;
    const resetAt = nextQuotaReset();
    return {
      role: principal.role,
      plan,
      planUntil: principal.planUntil ? new Date(principal.planUntil) : null,
      permissions: this.policy.permissionsOf(principal),
      quotas: {
        analysisDaily: {
          limit: dailyLimit,
          used,
          remaining:
            dailyLimit === null ? null : Math.max(0, dailyLimit - used),
          resetAt,
        },
      },
      limits: {
        savedPlaces: { limit: limits.savedPlaces, current: 0 },
        activeListings: { limit: limits.activeListings, current: 0 },
        comparePlaces: limits.comparePlaces,
        historyDays: limits.historyDays,
      },
      credits: {
        valuation: principal.userId
          ? await this.admin.balance(principal.userId)
          : 0,
      },
    };
  }
}
