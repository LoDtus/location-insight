import { Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { FollowListQueryDto, RelationshipsQueryDto } from './dto/follow.dto.js';
import { FollowService } from './follow.service.js';

@Controller()
export class FollowController {
  constructor(private readonly follow: FollowService) {}

  @RequirePermission('follow:read')
  @Get('users/:userId/follow')
  state(@Param('userId', ParseUUIDPipe) userId: string, @Req() request: RequestWithPrincipal) {
    return this.follow.state(this.viewer(request), userId);
  }

  @RequirePermission('follow:write')
  @Put('users/:userId/follow')
  doFollow(@Param('userId', ParseUUIDPipe) userId: string, @Req() request: RequestWithPrincipal) {
    return this.follow.follow(this.viewer(request), userId);
  }

  @RequirePermission('follow:write')
  @Delete('users/:userId/follow')
  unfollow(@Param('userId', ParseUUIDPipe) userId: string, @Req() request: RequestWithPrincipal) {
    return this.follow.unfollow(this.viewer(request), userId);
  }

  @RequirePermission('follow:read')
  @Get('users/:userId/followers')
  followers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: FollowListQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.follow.list('followers', this.viewer(request), userId, query.cursor, query.limit);
  }

  @RequirePermission('follow:read')
  @Get('users/:userId/following')
  following(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: FollowListQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.follow.list('following', this.viewer(request), userId, query.cursor, query.limit);
  }

  @RequirePermission('follow:read')
  @Get('follow/relationships')
  relationships(@Query() query: RelationshipsQueryDto, @Req() request: RequestWithPrincipal) {
    return this.follow.relationships(this.viewer(request), query.ids);
  }

  private viewer(request: RequestWithPrincipal): string {
    return request.principal?.userId as string;
  }
}
