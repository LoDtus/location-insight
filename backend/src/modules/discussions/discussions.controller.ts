import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { DiscussionsService } from './discussions.service.js';
import {
  AuthorPostsQueryDto,
  CreateMediaDto,
  CreatePostDto,
  CreateReplyDto,
  CreateTopicDto,
  CursorQueryDto,
  PostSettingsDto,
  PresenceQueryDto,
  ReportPostDto,
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
    @Query() query: AuthorPostsQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.listAuthorPosts(
      username,
      this.userId(request),
      query.cursor,
      query.sort ?? 'newest',
    );
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

  /** Lưu bài để đọc lại (riêng từng người, đồng bộ mọi thiết bị). */
  @RequirePermission('discussion:read')
  @Put('posts/:id/bookmark')
  bookmark(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.discussions.setBookmark(this.userId(request), id, true);
  }

  @RequirePermission('discussion:read')
  @Delete('posts/:id/bookmark')
  unbookmark(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.discussions.setBookmark(this.userId(request), id, false);
  }

  /** Sửa cài đặt bài gốc của chính mình. */
  @RequirePermission('discussion:write')
  @Patch('posts/:id/settings')
  settings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PostSettingsDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.updateSettings(this.userId(request), id, body);
  }

  /** Bài hẹn giờ của chính mình (hủy = xóa bài). */
  @RequirePermission('discussion:write')
  @Header('Cache-Control', 'private, no-store')
  @Get('scheduled')
  scheduled(@Req() request: RequestWithPrincipal) {
    return this.discussions.listScheduled(this.userId(request));
  }

  /** Ghi một lượt xem khi mở bài (mỗi người một lần mỗi 24 giờ). */
  @RequirePermission('discussion:read')
  @Post('posts/:id/view')
  @HttpCode(HttpStatus.OK)
  view(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.discussions.recordView(this.userId(request), id);
  }

  /** Làm mới chấm trực tuyến của các tác giả đang hiện (feed gọi định kỳ khi tab đang mở). */
  @RequirePermission('discussion:read')
  @Header('Cache-Control', 'private, no-store')
  @Get('presence')
  presence(@Query() query: PresenceQueryDto, @Req() request: RequestWithPrincipal) {
    return this.discussions.presence(this.userId(request), query.ids);
  }

  @RequirePermission('discussion:read')
  @Get('bookmarks')
  bookmarks(@Query() query: CursorQueryDto, @Req() request: RequestWithPrincipal) {
    return this.discussions.listBookmarks(this.userId(request), query.cursor);
  }

  @RequirePermission('discussion:read')
  @Post('posts/:id/report')
  @HttpCode(HttpStatus.OK)
  report(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReportPostDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.discussions.report(this.userId(request), id, body);
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
