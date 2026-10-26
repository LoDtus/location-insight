import { INestApplication } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export const configurePermissionsPolicy = (app: INestApplication): void => {
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      [
        'geolocation=(self)',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
      ].join(', '),
    );
    next();
  });
};
