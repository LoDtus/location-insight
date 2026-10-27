import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  AuthRateLimit,
  Public,
} from '../../common/decorators/access.decorator.js';
import { SepayWebhookService } from './sepay-webhook.service.js';

@SkipThrottle()
@Controller('billing/sepay')
export class SepayWebhookController {
  constructor(private readonly sepay: SepayWebhookService) {}

  @Public()
  @AuthRateLimit('sepay')
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  receive(@Req() request: RawBodyRequest<Request>) {
    return this.sepay.receive(request);
  }
}
