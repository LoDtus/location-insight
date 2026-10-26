import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export const configureHelmet = (app: INestApplication, env: string): void => {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
        },
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      hidePoweredBy: true,
      dnsPrefetchControl: { allow: false },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts:
        env === 'production'
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
      xXssProtection: true,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
};
