import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/access.decorator.js';
import { ArticlesService } from './articles.service.js';
import { ArticleListQueryDto } from './dto/article.dto.js';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

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
}
