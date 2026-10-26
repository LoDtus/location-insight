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

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
