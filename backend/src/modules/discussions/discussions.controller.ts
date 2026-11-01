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
import { DiscussionsService } from './discussions.service.js';
import {
  CreateMediaDto,
  CreatePostDto,
  CreateReplyDto,
  CreateTopicDto,
  CursorQueryDto,
} from './dto/discussion.dto.js';

@Controller('discussions')
export class DiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @RequirePermission('discussion:read')
  @Get('topics')
  topics(@Query() query: CursorQueryDto) {
    return this.discussions.listTopics(query.query, query.cursor);
  }

  @RequirePermission('discussion:write')
  @Post('topics')
  createTopic(
    @Body() body: CreateTopicDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.createTopic(this.userId(request), body);
  }

  @RequirePermission('discussion:read')
  @Get('topics/:slug')
  topic(
    @Param('slug') slug: string,
    @Query() query: CursorQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.topicFeed(slug, this.userId(request), query.cursor);
  }

  @RequirePermission('discussion:read')
  @Get('posts')
  posts(@Query() query: CursorQueryDto, @Req() request: RequestWithPrincipal) {
    return this.discussions.listPosts(this.userId(request), query.cursor, query.scope === 'following');
  }

  @RequirePermission('discussion:read')
  @Get('authors/:username/posts')
  authorPosts(
    @Param('username') username: string,
    @Query() query: CursorQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.listAuthorPosts(username, this.userId(request), query.cursor);
  }

  @RequirePermission('discussion:write')
  @Post('posts')
  createPost(
    @Body() body: CreatePostDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.createPost(this.userId(request), body);
  }

  @RequirePermission('discussion:read')
  @Get('posts/:id')
  thread(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.getThread(id, this.userId(request), query.cursor);
  }

  @RequirePermission('discussion:write')
  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.removeOwn(this.userId(request), id);
  }

  @RequirePermission('discussion:write')
  @Post('posts/:id/replies')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateReplyDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.reply(this.userId(request), id, body);
  }

  @RequirePermission('discussion:write')
  @Post('posts/:id/likes')
  like(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.like(this.userId(request), id);
  }

  @RequirePermission('discussion:write')
  @Delete('posts/:id/likes')
  unlike(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.unlike(this.userId(request), id);
  }

  @RequirePermission('discussion:write')
  @Post('media')
  media(@Body() body: CreateMediaDto, @Req() request: RequestWithPrincipal) {
    return this.discussions.prepareMedia(this.userId(request), body);
  }

  @RequirePermission('discussion:write')
  @Post('media/:id/complete')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.completeMedia(this.userId(request), id);
  }

  private userId(request: RequestWithPrincipal): string {
    return request.principal?.userId as string;
  }
}
