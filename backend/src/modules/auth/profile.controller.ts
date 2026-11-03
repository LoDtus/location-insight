import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from './auth.guard.js';
import { PrepareAvatarDto, UpdateProfileDto } from './dto/profile.dto.js';
import { ProfileService } from './profile.service.js';

@Controller('profiles')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @RequirePermission('profile:read')
  @Get('me')
  getOwn(@Req() request: RequestWithPrincipal) {
    return this.profiles.getOwn(request.principal?.userId as string);
  }

  @RequirePermission('profile:update')
  @Patch('me')
  update(
    @Req() request: RequestWithPrincipal,
    @Body() body: UpdateProfileDto,
  ) {
    return this.profiles.update(request.principal?.userId as string, body);
  }

  @RequirePermission('profile:update')
  @Post('me/avatar')
  prepareAvatar(
    @Req() request: RequestWithPrincipal,
    @Body() body: PrepareAvatarDto,
  ) {
    return this.profiles.prepareAvatar(request.principal?.userId as string, body);
  }

  @RequirePermission('profile:update')
  @Post('me/avatar/complete')
  completeAvatar(@Req() request: RequestWithPrincipal) {
    return this.profiles.completeAvatar(request.principal?.userId as string);
  }

  @RequirePermission('profile:read')
  @Get('avatars/:fileId')
  getSharedAvatar(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.profiles.getSharedAvatar(fileId);
  }

  @RequirePermission('profile:read')
  @Get('id/:userId')
  getById(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.profiles.getById(userId);
  }

  @RequirePermission('profile:read')
  @Get(':username')
  getPublic(@Param('username') username: string) {
    return this.profiles.getPublic(username);
  }
}
