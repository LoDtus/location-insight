import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import {
  DeviceQueryDto,
  EndpointDto,
  NotificationListQueryDto,
  PreferencesPatchDto,
  PushDevicePatchDto,
  PushSubscribeDto,
  ReadAllDto,
  ReadBatchDto,
  SuspendDeviceDto,
} from './dto/notification.dto.js';
import { NotificationPushService } from './notification-push.service.js';
import { NotificationsService } from './notification.service.js';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: NotificationPushService,
  ) {}

  @RequirePermission('notification:read')
  @Get()
  list(@Query() query: NotificationListQueryDto, @Req() request: RequestWithPrincipal) {
    return this.notifications.list(this.userId(request), query.limit, query.cursor, query.filter ?? 'all');
  }

  @RequirePermission('notification:read')
  @Get('unread-count')
  unread(@Req() request: RequestWithPrincipal) {
    return this.notifications.unreadCount(this.userId(request));
  }

  @RequirePermission('notification:read')
  @Get('preferences')
  preferences(@Req() request: RequestWithPrincipal) {
    return this.notifications.preferencesOf(this.userId(request));
  }

  @RequirePermission('notification:update')
  @Patch('preferences')
  patchPreferences(@Body() body: PreferencesPatchDto, @Req() request: RequestWithPrincipal) {
    return this.notifications.updatePreferences(this.userId(request), body);
  }

  @RequirePermission('notification:read')
  @Get('push/config')
  config() {
    return this.push.configView();
  }

  @RequirePermission('notification:read')
  @Get('push/subscriptions')
  devices(@Query() query: DeviceQueryDto, @Req() request: RequestWithPrincipal) {
    return this.push.list(this.userId(request), query.deviceId);
  }

  @RequirePermission('notification:update')
  @Post('push/subscriptions')
  @HttpCode(HttpStatus.CREATED)
  subscribe(@Body() body: PushSubscribeDto, @Req() request: RequestWithPrincipal) {
    return this.push.subscribe(this.userId(request), body);
  }

  @RequirePermission('notification:update')
  @Post('push/subscriptions/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  suspend(@Body() body: SuspendDeviceDto, @Req() request: RequestWithPrincipal) {
    return this.push.suspendDevice(this.userId(request), body.deviceId, 'logout');
  }

  @RequirePermission('notification:update')
  @Post('push/subscriptions/by-endpoint')
  @HttpCode(HttpStatus.NO_CONTENT)
  byEndpoint(@Body() body: EndpointDto, @Req() request: RequestWithPrincipal) {
    return this.push.removeByEndpoint(this.userId(request), body.endpoint);
  }

  @RequirePermission('notification:update')
  @Post('push/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  test(@Req() request: RequestWithPrincipal) {
    return this.push.sendTest(this.userId(request));
  }

  @RequirePermission('notification:update')
  @Patch('push/subscriptions/:id')
  patchDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PushDevicePatchDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.push.updateDevice(this.userId(request), id, body);
  }

  @RequirePermission('notification:update')
  @Delete('push/subscriptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDevice(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.push.removeDevice(this.userId(request), id);
  }

  @RequirePermission('notification:update')
  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  read(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.notifications.markRead(this.userId(request), id);
  }

  @RequirePermission('notification:update')
  @Put(':id/unread')
  @HttpCode(HttpStatus.NO_CONTENT)
  unreadOne(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.notifications.markUnread(this.userId(request), id);
  }

  @RequirePermission('notification:update')
  @Post('read-batch')
  @HttpCode(HttpStatus.NO_CONTENT)
  readBatch(@Body() body: ReadBatchDto, @Req() request: RequestWithPrincipal) {
    return this.notifications.markReadBatch(this.userId(request), body.ids);
  }

  @RequirePermission('notification:update')
  @Post('read-all')
  readAll(@Body() body: ReadAllDto, @Req() request: RequestWithPrincipal) {
    return this.notifications.markReadAll(this.userId(request), body.upToId);
  }

  @RequirePermission('notification:update')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.notifications.remove(this.userId(request), id);
  }

  private userId(request: RequestWithPrincipal): string {
    return request.principal?.userId as string;
  }
}
