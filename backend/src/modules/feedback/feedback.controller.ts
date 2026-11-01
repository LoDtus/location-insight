import {
  Body,
  Controller,
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
import { clientIp } from '../auth/auth.constants.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { Principal } from '../rbac/authorization.types.js';
import {
  CreateFeedbackDto,
  FeedbackListQueryDto,
  FeedbackMediaDto,
  FeedbackReplyDto,
  FeedbackStatusDto,
} from './dto/feedback.dto.js';
import { FeedbackService } from './feedback.service.js';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @RequirePermission('feedback:write')
  @Post('media')
  media(@Body() body: FeedbackMediaDto, @Req() request: RequestWithPrincipal) {
    return this.feedback.prepareMedia(this.userId(request), body);
  }

  @RequirePermission('feedback:write')
  @Post('media/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.feedback.completeMedia(this.userId(request), id);
  }

  @RequirePermission('feedback:write')
  @Post()
  create(@Body() body: CreateFeedbackDto, @Req() request: RequestWithPrincipal) {
    return this.feedback.create(this.userId(request), body);
  }

  @RequirePermission('feedback:write')
  @Get()
  list(@Query() query: FeedbackListQueryDto, @Req() request: RequestWithPrincipal) {
    return this.feedback.listMine(this.userId(request), query);
  }

  @RequirePermission('feedback:write')
  @Get('unread-count')
  unread(@Req() request: RequestWithPrincipal) {
    return this.feedback.unreadCount(this.userId(request));
  }

  @RequirePermission('feedback:write')
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.feedback.getMine(this.userId(request), id);
  }

  @RequirePermission('feedback:write')
  @Post(':id/replies')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FeedbackReplyDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.feedback.replyAsUser(this.userId(request), id, body.body);
  }

  private userId(request: RequestWithPrincipal): string {
    return request.principal?.userId as string;
  }
}

@Controller('admin/feedback')
export class FeedbackAdminController {
  constructor(private readonly feedback: FeedbackService) {}

  @RequirePermission('feedback:manage')
  @Get()
  list(@Query() query: FeedbackListQueryDto) {
    return this.feedback.listAll(query);
  }

  @RequirePermission('feedback:manage')
  @Get('open-count')
  openCount() {
    return this.feedback.openCount();
  }

  @RequirePermission('feedback:manage')
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedback.getAny(id);
  }

  @RequirePermission('feedback:manage')
  @Post(':id/replies')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FeedbackReplyDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.feedback.replyAsAdmin(request.principal as Principal, id, body.body, clientIp(request.ip));
  }

  @RequirePermission('feedback:manage')
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FeedbackStatusDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.feedback.setStatus(request.principal as Principal, id, body.status, clientIp(request.ip));
  }
}
