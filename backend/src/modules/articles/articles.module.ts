import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesAdminController } from './articles-admin.controller.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesMaintenanceService } from './articles-maintenance.service.js';
import { ArticlesService } from './articles.service.js';
import { ArticleEntity } from './entities/article.entity.js';
import { SeedArticleService } from './seed-article.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ArticleEntity])],
  controllers: [ArticlesController, ArticlesAdminController],
  providers: [ArticlesService, ArticlesMaintenanceService, SeedArticleService],
})
export class ArticlesModule {}
