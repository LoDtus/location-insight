import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { ArticleDiscoveryService } from './article-discovery.service.js';
import { ArticleEngagementService } from './article-engagement.service.js';
import { ArticlesAdminController } from './articles-admin.controller.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesMaintenanceService } from './articles-maintenance.service.js';
import { ArticlesService } from './articles.service.js';
import { ArticleCommentLikeEntity } from './entities/article-comment-like.entity.js';
import { ArticleCommentEntity } from './entities/article-comment.entity.js';
import { ArticleViewDailyEntity } from './entities/article-view-daily.entity.js';
import { ArticleVoteEntity } from './entities/article-vote.entity.js';
import { ArticleEntity } from './entities/article.entity.js';
import { SeedArticleService } from './seed-article.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ArticleEntity,
      ArticleVoteEntity,
      ArticleCommentEntity,
      ArticleCommentLikeEntity,
      ArticleViewDailyEntity,
      UserEntity,
    ]),
  ],
  controllers: [ArticlesController, ArticlesAdminController],
  providers: [ArticlesService, ArticleEngagementService, ArticleDiscoveryService, ArticlesMaintenanceService, SeedArticleService],
})
export class ArticlesModule {}
