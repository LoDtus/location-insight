import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { clientIp } from '../auth/auth.constants.js';
import { AdminUsersService } from './admin-users.service.js';
import { Principal } from './authorization.types.js';
import {
  AdminUserQueryDto,
  AuditQueryDto,
  GrantCreditDto,
  GrantSubscriptionDto,
  ReasonDto,
} from './dto/admin.dto.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminUsersService) {}

  @RequirePermission('user:read')
  @Get('users')
  search(@Query() query: AdminUserQueryDto) {
    return this.admin.search(query);
  }

  @RequirePermission('audit:read')
  @Get('audit-logs')
  audits(@Query() query: AuditQueryDto) {
    return this.admin.listAudits(query);
  }

  @RequirePermission('user:read')
  @Get('users/:userId')
  user(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.get(userId);
  }

  @RequirePermission('user:lock')
  @Post('users/:userId/lock')
  @HttpCode(HttpStatus.NO_CONTENT)
  lock(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: ReasonDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.lock(
      this.actor(request),
      userId,
      body.reason,
      clientIp(request.ip),
    );
  }

  @RequirePermission('user:lock')
  @Delete('users/:userId/lock')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlock(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: ReasonDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.unlock(
      this.actor(request),
      userId,
      body.reason,
      clientIp(request.ip),
    );
  }

  @RequirePermission('user:session:revoke')
  @Post('users/:userId/sessions/revoke')
  revoke(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: ReasonDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.revokeSessions(
      this.actor(request),
      userId,
      body.reason,
      clientIp(request.ip),
    );
  }

  @RequirePermission('subscription:grant')
  @Post('users/:userId/subscriptions')
  @HttpCode(HttpStatus.CREATED)
  grantPlan(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: GrantSubscriptionDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.grantSubscription(
      this.actor(request),
      userId,
      body,
      clientIp(request.ip),
    );
  }

  @RequirePermission('subscription:grant')
  @Delete('users/:userId/subscriptions/:subscriptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  endPlan(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Body() body: ReasonDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.endSubscription(
      this.actor(request),
      userId,
      subscriptionId,
      body.reason,
      clientIp(request.ip),
    );
  }

  @RequirePermission('credit:grant')
  @Post('users/:userId/credits')
  @HttpCode(HttpStatus.CREATED)
  credits(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: GrantCreditDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.grantCredit(
      this.actor(request),
      userId,
      body,
      clientIp(request.ip),
    );
  }

  @RequirePermission('quota:reset')
  @Post('users/:userId/quota/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetQuota(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: ReasonDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.resetQuota(
      this.actor(request),
      userId,
      body.reason,
      clientIp(request.ip),
    );
  }

  private actor(request: RequestWithPrincipal): Principal {
    return request.principal as Principal;
  }
}
