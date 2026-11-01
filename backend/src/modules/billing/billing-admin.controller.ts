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
  ChangePlanDto,
  DirectoryQueryDto,
  ResolveOrderDto,
  RevokeDto,
} from './dto/billing.dto.js';
import { UserDirectoryService } from './user-directory.service.js';

@Controller('admin/billing')
export class BillingAdminController {
  constructor(
    private readonly admin: BillingAdminService,
    private readonly directory: UserDirectoryService,
  ) {}

  @RequirePermission('user:read')
  @Get('directory')
  directoryList(@Query() query: DirectoryQueryDto) {
    return this.directory.list(query);
  }

  @RequirePermission('subscription:grant')
  @Post('users/:userId/renew')
  renew(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.directory.renew(this.actor(request), userId, clientIp(request.ip));
  }

  @RequirePermission('subscription:grant')
  @Post('users/:userId/cancel')
  cancelPlan(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.directory.cancel(this.actor(request), userId, clientIp(request.ip));
  }

  @RequirePermission('subscription:grant')
  @Post('users/:userId/plan')
  changePlan(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: ChangePlanDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.directory.changePlan(
      this.actor(request),
      userId,
      body.plan,
      clientIp(request.ip),
    );
  }

  @RequirePermission('admin:access')
  @Get('orders')
  orders(@Query() query: AdminListQueryDto) {
    return this.admin.listOrders(query.status, query.page ?? 1);
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

  private actor(request: RequestWithPrincipal): Principal {
    return request.principal as Principal;
  }
}
