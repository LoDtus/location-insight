import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { ArticlesService } from './articles.service.js';
import {
  ArticleFrequencyQueryDto,
  ArticleListQueryDto,
  ArticlePositionQueryDto,
  ArticleWriteDto,
  IngestArticleDto,
} from './dto/article.dto.js';

@Controller('admin/blogs')
export class ArticlesAdminController {
  constructor(private readonly articles: ArticlesService) {}

  @RequirePermission('admin:access')
  @Get()
  list(@Query() query: ArticleListQueryDto) {
    return this.articles.listAdmin(query);
  }

  @RequirePermission('admin:access')
  @Get('position')
  position(@Query() query: ArticlePositionQueryDto) {
    return this.articles.adminPosition(query);
  }

  @RequirePermission('admin:access')
  @Get('frequency')
  frequency(@Query() query: ArticleFrequencyQueryDto) {
    return this.articles.publishedFrequency(query);
  }

  @RequirePermission('admin:access')
  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.articles.getAdmin(id);
  }

  @RequirePermission('admin:access')
  @Post()
  create(@Body() body: ArticleWriteDto, @Req() request: RequestWithPrincipal) {
    return this.articles.create(request.principal?.userId ?? null, body);
  }

  @RequirePermission('admin:access')
  @Post('ingest')
  ingest(@Body() body: IngestArticleDto) {
    return this.articles.ingest(body);
  }

  @RequirePermission('admin:access')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ArticleWriteDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.articles.update(id, request.principal?.userId ?? null, body);
  }

  @RequirePermission('admin:access')
  @Post(':id/hide')
  hide(@Param('id', ParseUUIDPipe) id: string) {
    return this.articles.hide(id);
  }

  @RequirePermission('admin:access')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.articles.remove(id);
  }

  @RequirePermission('admin:access')
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.articles.restore(id);
  }
}
