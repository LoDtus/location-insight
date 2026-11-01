import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from './auth.guard.js';
import { UpdateProfileDto } from './dto/profile.dto.js';
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

  @RequirePermission('profile:read')
  @Get(':username')
  getPublic(@Param('username') username: string) {
    return this.profiles.getPublic(username);
  }
}
