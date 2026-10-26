import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const configureSwagger = (
  app: INestApplication,
  port: number,
  globalPrefix: string,
  title: string,
): void => {
  const logger = new Logger('Bootstrap');
  const config = new DocumentBuilder()
    .setTitle(title)
    .setDescription('API Documentation')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const route = 'swagger';

  SwaggerModule.setup(route, app, document, {
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customSiteTitle: `${title} API`,
  });

  logger.log(
    `Swagger UI available at: http://localhost:${port}/${globalPrefix}/${route}`,
  );
};
