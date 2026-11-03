import './load-env.js';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { setupGracefulShutdown } from 'nestjs-graceful-shutdown';
import { AppModule } from './app.module.js';
import { configureCors } from './shared/config/cors.config.js';
import { configureHelmet } from './shared/config/helmet.config.js';
import { configurePermissionsPolicy } from './shared/config/permissions-policy.config.js';
import { configureSwagger } from './shared/config/swagger.config.js';
import { configureValidationPipe } from './shared/config/validation-pipe.config.js';

/** Cờ reset dev bật ở môi trường không phải dev là lỗi cấu hình nghiêm trọng: dừng ngay, không khởi động. */
function assertNoDevToolsOutsideDev(): void {
  const names = ['NODE_ENV', 'APP_ENV', 'ENVIRONMENT', 'DEPLOY_ENV', 'STAGE'];
  const nonDev = names.some((name) =>
    ['production', 'prod', 'staging', 'stage', 'live'].includes(
      (process.env[name] ?? '').trim().toLowerCase(),
    ),
  );
  const flagged = ['DEV_RESET_ENABLED', 'DEV_RESET_TOKEN'].some(
    (name) => (process.env[name] ?? '').trim() !== '' && process.env[name] !== 'false',
  );
  if (nonDev && flagged) {
    throw new Error(
      'DEV_RESET_ENABLED/DEV_RESET_TOKEN không được đặt ngoài môi trường development. Xóa chúng khỏi cấu hình.',
    );
  }
}

/**
 * Lỗi bất đồng bộ không ai bắt (vd. DNS/Postgres đứt thoáng qua) làm Node thoát.
 * Dev chạy dưới `nest start --watch` nên cha vẫn sống, container vẫn "Up" nhưng
 * không còn ai listen cổng → website báo ECONNREFUSED. Dev: chỉ ghi log để server
 * sống tiếp. Production: thoát để `restart: unless-stopped` dựng lại tiến trình.
 */
function installProcessErrorHandlers(): void {
  const logger = new Logger('Process');
  const isProd = (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
  const handle = (kind: string) => (reason: unknown) => {
    logger.error(
      `${kind}: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
    );
    if (isProd) process.exit(1);
  };
  process.on('unhandledRejection', handle('unhandledRejection'));
  process.on('uncaughtException', handle('uncaughtException'));
}

async function bootstrap(): Promise<void> {
  installProcessErrorHandlers();
  assertNoDevToolsOutsideDev();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const port = Number(
    config.get('PORT') ?? config.get('BACKEND_PORT') ?? 22370,
  );
  const globalPrefix = config.get<string>('GLOBAL_PREFIX') ?? 'api/v1';
  const env = config.get<string>('NODE_ENV') ?? 'development';

  const hops = Number(config.get('TRUST_PROXY_HOPS') ?? 1);
  app.set('trust proxy', Number.isNaN(hops) ? 1 : hops);
  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));
  configureHelmet(app, env);
  configureCors(app, config.get<string>('CORS_ORIGINS'));
  configurePermissionsPolicy(app);
  app.setGlobalPrefix(globalPrefix);
  configureValidationPipe(app);

  if (env !== 'production') {
    configureSwagger(
      app,
      port,
      globalPrefix,
      config.get<string>('APPLICATION_NAME') ?? 'Location Insight',
    );
  }

  setupGracefulShutdown({ app });
  await app.listen(port);
  logger.log(
    `Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  logger.log(`Environment: ${env}`);
}

try {
  await bootstrap();
} catch (error) {
  console.error('Bootstrap failed:', error);
  process.exit(1);
}
