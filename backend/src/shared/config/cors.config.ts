import { INestApplication } from '@nestjs/common';

const DEFAULT_ORIGINS = ['http://localhost:22360', 'http://127.0.0.1:22360'];

export const configureCors = (
  app: INestApplication,
  rawOrigins?: string,
): void => {
  const allowedOrigins = rawOrigins
    ? rawOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : DEFAULT_ORIGINS;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'x-api-key',
      'x-trace-id',
    ],
    exposedHeaders: ['X-Trace-Id', 'Retry-After'],
    credentials: true,
    maxAge: 86400,
  });
};
