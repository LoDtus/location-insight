import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { GracefulShutdownModule } from 'nestjs-graceful-shutdown';
import { ClsModule } from 'nestjs-cls';
import { v7 as uuidv7 } from 'uuid';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ElasticsearchIntegrationModule } from './integrations/elasticsearch/elasticsearch.module.js';
import { RedisThrottlerStorage } from './integrations/redis/redis-throttler.storage.js';
import { RedisModule } from './integrations/redis/redis.module.js';
import { StorageModule } from './integrations/storage/storage.module.js';
import { CoreModule } from './modules/core/core.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UserModule } from './modules/user/user.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { ArticlesModule } from './modules/articles/articles.module.js';
import { DiscussionsModule } from './modules/discussions/discussions.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { FollowModule } from './modules/follow/follow.module.js';
import { FeedbackModule } from './modules/feedback/feedback.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { TypeOrmDatabaseModule } from './shared/database/typeorm/typeorm.module.js';
import { isTestRuntime } from './shared/utils/runtime.util.js';

const nodeEnv = process.env.NODE_ENV || 'development';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: { headers: Record<string, unknown> }) => {
          const traceId = req.headers['x-trace-id'];
          const correlationId = req.headers['x-correlation-id'];
          if (typeof traceId === 'string' && traceId) return traceId;
          if (typeof correlationId === 'string' && correlationId) {
            return correlationId;
          }
          return uuidv7();
        },
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: isTestRuntime(),
      envFilePath: [`.env.${nodeEnv}`, `../.env.${nodeEnv}`],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1000, limit: 5 },
          { name: 'medium', ttl: 10000, limit: 20 },
          { name: 'long', ttl: 60000, limit: 100 },
        ],
        skipIf: () => config.get<string>('NODE_ENV') !== 'production',
        errorMessage: 'Quá nhiều yêu cầu, vui lòng thử lại sau vài giây.',
        ignoreUserAgents: [/health|prometheus|monitoring/i],
        ...(isTestRuntime()
          ? {}
          : { storage: new RedisThrottlerStorage(config) }),
      }),
    }),
    ...(isTestRuntime()
      ? []
      : [
          GracefulShutdownModule.forRoot({
            gracefulShutdownTimeout: 120000,
            keepNodeProcessAlive: false,
          }),
        ]),
    CoreModule,
    ...(isTestRuntime()
      ? []
      : [
          TypeOrmDatabaseModule,
          RedisModule,
          ElasticsearchIntegrationModule,
          StorageModule,
          HealthModule,
        ]),
    UserModule,
    ...(isTestRuntime()
        ? []
        : [AuthModule, RbacModule, BillingModule, ArticlesModule, DiscussionsModule, MessagingModule, FeedbackModule, FollowModule, EmailModule]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
