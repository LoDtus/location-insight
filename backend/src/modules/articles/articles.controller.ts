import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  AuthenticatedOnly,
  Public,
  RequirePermission,
} from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { UserRole } from '../rbac/authorization.types.js';
import { ArticleEngagementService } from './article-engagement.service.js';
import { ArticlesService } from './articles.service.js';
import {
  ArticleListQueryDto,
  ArticleVoteDto,
  CommentEditDto,
  CommentLikeDto,
  CommentListQueryDto,
  CommentWriteDto,
} from './dto/article.dto.js';

function userId(request: RequestWithPrincipal): string {
  return request.principal?.userId as string;
}

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articles: ArticlesService,
    private readonly engagement: ArticleEngagementService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ArticleListQueryDto) {
    return this.articles.listPublic(query);
  }

  @Public()
  @Get(':slug')
  one(@Param('slug') slug: string) {
    return this.articles.getPublic(slug);
  }

  @Public()
  @Get(':slug/stats')
  async stats(@Param('slug') slug: string) {
    const article = await this.articles.findVisible(slug);
    return this.engagement.stats(article.id);
  }

  @Public()
  @Get(':slug/related')
  related(@Param('slug') slug: string) {
    return this.articles.related(slug);
  }

  @Public()
  @Get(':slug/comments')
  async comments(@Param('slug') slug: string, @Query() query: CommentListQueryDto) {
    const article = await this.articles.findVisible(slug);
    return this.engagement.list(article.id, query.sort ?? 'new', query.page ?? 1, null);
  }

  /** Trạng thái riêng của người đang đăng nhập: phiếu của họ và các bình luận họ đã thích. */
  @RequirePermission('comment:create')
  @Get(':slug/me')
  async me(@Param('slug') slug: string, @Req() request: RequestWithPrincipal) {
    const article = await this.articles.findVisible(slug);
    return this.engagement.myState(article.id, userId(request));
  }

  @RequirePermission('comment:create')
  @Put(':slug/vote')
  async vote(@Param('slug') slug: string, @Body() body: ArticleVoteDto, @Req() request: RequestWithPrincipal) {
    const article = await this.articles.findVisible(slug);
    return this.engagement.vote(article.id, userId(request), body.value);
  }

  @RequirePermission('comment:create')
  @Post(':slug/comments')
  async comment(@Param('slug') slug: string, @Body() body: CommentWriteDto, @Req() request: RequestWithPrincipal) {
    const article = await this.articles.findVisible(slug);
    return this.engagement.create(article.id, userId(request), body.body, body.parentId);
  }

  @RequirePermission('comment:create')
  @Patch('comments/:id')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() body: CommentEditDto, @Req() request: RequestWithPrincipal) {
    return this.engagement.edit(id, userId(request), body.body);
  }

  @AuthenticatedOnly()
  @Delete('comments/:id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.engagement.remove(id, userId(request), request.principal?.role === UserRole.ADMIN);
  }

  @RequirePermission('comment:create')
  @Put('comments/:id/like')
  like(@Param('id', ParseUUIDPipe) id: string, @Body() body: CommentLikeDto, @Req() request: RequestWithPrincipal) {
    return this.engagement.like(id, userId(request), body.liked);
  }
}
