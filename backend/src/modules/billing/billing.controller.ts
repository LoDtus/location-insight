import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  AuthenticatedOnly,
  Public,
} from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { BillingRefundService } from './billing-refund.service.js';
import { BillingService } from './billing.service.js';
import { CreateOrderDto, CreateRefundDto } from './dto/billing.dto.js';

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly refunds: BillingRefundService,
  ) {}

  @Public()
  @Get('billing/catalog')
  catalog() {
    return this.billing.catalog();
  }

  @AuthenticatedOnly()
  @Post('billing/orders')
  create(
    @Body() body: CreateOrderDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.billing.createOrder(this.userId(request), body);
  }

  @AuthenticatedOnly()
  @Get('billing/orders/:id')
  order(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.billing.getOwnOrder(this.userId(request), id);
  }

  @AuthenticatedOnly()
  @Delete('billing/orders/:id')
  cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.billing.cancelOwnOrder(this.userId(request), id);
  }

  @AuthenticatedOnly()
  @Post('billing/orders/:id/refunds')
  requestRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateRefundDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.refunds.create(this.userId(request), id, body);
  }

  @AuthenticatedOnly()
  @Get('me/billing/refunds')
  myRefunds(@Req() request: RequestWithPrincipal) {
    return this.refunds.listOwn(this.userId(request));
  }

  @AuthenticatedOnly()
  @Get('me/billing')
  mine(@Req() request: RequestWithPrincipal) {
    return this.billing.myBilling(this.userId(request));
  }

  @AuthenticatedOnly()
  @Post('me/billing/subscriptions/:id/cancel')
  cancelSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.billing.cancelSubscription(this.userId(request), id);
  }

  @AuthenticatedOnly()
  @Post('me/billing/subscriptions/:id/resume')
  resumeSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.billing.resumeSubscription(this.userId(request), id);
  }

  @AuthenticatedOnly()
  @Post('me/billing/notices/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  readNotice(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.billing.markNoticeRead(this.userId(request), id);
  }

  private userId(request: RequestWithPrincipal): string {
    return request.principal?.userId as string;
  }
}
