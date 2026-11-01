import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { clientIp } from '../auth/auth.constants.js';
import { Principal } from '../rbac/authorization.types.js';
import { DiscussionsService } from './discussions.service.js';
import { HidePostDto, ReasonStatusDto } from './dto/discussion.dto.js';

@Controller('admin/discussions')
export class DiscussionsAdminController {
  constructor(private readonly discussions: DiscussionsService) {}

  @RequirePermission('discussion:moderate')
  @Post('topics/:id/status')
  topicStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReasonStatusDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.setTopicStatus(
      this.actor(request),
      id,
      body.status,
      body.reason,
      clientIp(request.ip),
    );
  }

  @RequirePermission('discussion:moderate')
  @Post('posts/:id/hide')
  hide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: HidePostDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.hidePost(
      this.actor(request),
      id,
      body.hidden,
      body.reason,
      clientIp(request.ip),
    );
  }

  private actor(request: RequestWithPrincipal): Principal {
    return request.principal as Principal;
  }
}
