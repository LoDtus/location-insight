import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { clientIp } from '../auth/auth.constants.js';
import { Principal } from '../rbac/authorization.types.js';
import { BillingAdminService } from './billing-admin.service.js';
import {
  AdminListQueryDto,
  PaidOutDto,
  RefundDecisionDto,
  ResolveOrderDto,
  RevokeDto,
} from './dto/billing.dto.js';

@Controller('admin/billing')
export class BillingAdminController {
  constructor(private readonly admin: BillingAdminService) {}

  @RequirePermission('admin:access')
  @Get('orders')
  orders(@Query() query: AdminListQueryDto) {
    return this.admin.listOrders(query.status, query.page ?? 1);
  }

  @RequirePermission('admin:access')
  @Get('refunds')
  refunds(@Query() query: AdminListQueryDto) {
    return this.admin.listRefunds(query.page ?? 1);
  }

  @RequirePermission('admin:access')
  @Post('orders/:id/resolve')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveOrderDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.resolve(
      this.actor(request),
      id,
      body.decision,
      body.reason,
      clientIp(request.ip),
    );
  }

  @RequirePermission('admin:access')
  @Get('users/:userId')
  userBilling(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.userBilling(this.actor(request), userId);
  }

  @RequirePermission('admin:access')
  @Post('subscriptions/:id/revoke')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RevokeDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.revoke(
      this.actor(request),
      id,
      body.reason,
      clientIp(request.ip),
    );
  }

  @RequirePermission('admin:access')
  @Post('refunds/:id')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundDecisionDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.decideRefund(
      this.actor(request),
      id,
      body.decision,
      body.note,
      clientIp(request.ip),
    );
  }

  @RequirePermission('admin:access')
  @Post('refunds/:id/paid-out')
  paidOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PaidOutDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.markPaidOut(
      this.actor(request),
      id,
      body.referenceCode,
      clientIp(request.ip),
    );
  }

  private actor(request: RequestWithPrincipal): Principal {
    return request.principal as Principal;
  }
}
