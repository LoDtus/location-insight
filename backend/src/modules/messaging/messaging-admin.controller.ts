import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { clientIp } from '../auth/auth.constants.js';
import { Principal } from '../rbac/authorization.types.js';
import { AdminReportsQueryDto, ResolveReportDto } from './dto/messaging.dto.js';
import { MessagingSafetyService } from './messaging-safety.service.js';

@Controller('admin/messaging')
export class MessagingAdminController {
  constructor(private readonly safety: MessagingSafetyService) {}

  @RequirePermission('message:moderate')
  @Get('reports')
  reports(@Query() query: AdminReportsQueryDto) {
    return this.safety.listReports(query);
  }

  @RequirePermission('message:moderate')
  @Post('reports/:id/resolve')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveReportDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.safety.resolveReport(
      request.principal as Principal,
      id,
      body,
      clientIp(request.ip),
    );
  }
}
