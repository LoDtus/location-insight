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
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { AuthRateLimit, Public, RequirePermission } from '../../common/decorators/access.decorator.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { clientIp } from '../auth/auth.constants.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import { EmailAdminService } from './email-admin.service.js';
import { EmailService } from './email.service.js';
import {
  MessagesQueryDto,
  PreferenceDto,
  PreviewTemplateDto,
  SaveTemplateDto,
  SuppressionDto,
  TemplateQueryDto,
  TestTemplateDto,
  UnsubscribeQueryDto,
} from './dto/email.dto.js';
import { DEFAULT_LOCALE } from './email.constants.js';

@Controller('email')
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @RequirePermission('email:self')
  @Get('preferences')
  preferences(@Req() request: RequestWithPrincipal) {
    return this.email.preferences(request.principal?.userId as string);
  }

  @RequirePermission('email:self')
  @Put('preferences')
  async setPreference(@Body() body: PreferenceDto, @Req() request: RequestWithPrincipal) {
    await this.email.setPreference(request.principal?.userId as string, body.category, body.enabled);
    return this.email.preferences(request.principal?.userId as string);
  }

  /** Một chạm (RFC 8058): trình duyệt/ứng dụng thư gọi POST không có phiên đăng nhập. */
  @Public()
  @AuthRateLimit('unsubscribe')
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Query() query: UnsubscribeQueryDto) {
    const ok = await this.email.unsubscribe(query.u, query.c, query.t);
    if (!ok) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Liên kết hủy đăng ký không hợp lệ.',
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
    return { category: query.c, enabled: false };
  }
}

@Controller('admin/email')
export class EmailAdminController {
  constructor(private readonly admin: EmailAdminService) {}

  @RequirePermission('email:manage')
  @Get('templates')
  list() {
    return this.admin.listTemplates();
  }

  @RequirePermission('email:manage')
  @Get('templates/:key')
  get(@Param('key') key: string, @Query() query: TemplateQueryDto) {
    return this.admin.getTemplate(key, query.locale ?? DEFAULT_LOCALE);
  }

  @RequirePermission('email:manage')
  @Put('templates/:key/:locale')
  save(
    @Param('key') key: string,
    @Param('locale') locale: string,
    @Body() body: SaveTemplateDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.saveTemplate(request.principal!, key, locale, body, clientIp(request.ip));
  }

  @RequirePermission('email:manage')
  @Delete('templates/:key/:locale')
  reset(
    @Param('key') key: string,
    @Param('locale') locale: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.admin.resetTemplate(request.principal!, key, locale, clientIp(request.ip));
  }

  @RequirePermission('email:manage')
  @Post('templates/:key/preview')
  @HttpCode(HttpStatus.OK)
  preview(@Param('key') key: string, @Body() body: PreviewTemplateDto) {
    return this.admin.preview(key, body);
  }

  @RequirePermission('email:manage')
  @Post('templates/:key/test')
  @HttpCode(HttpStatus.ACCEPTED)
  test(@Param('key') key: string, @Body() body: TestTemplateDto, @Req() request: RequestWithPrincipal) {
    return this.admin.sendTest(request.principal!, key, body.locale ?? DEFAULT_LOCALE);
  }

  @RequirePermission('email:manage')
  @Get('messages')
  messages(@Query() query: MessagesQueryDto) {
    return this.admin.listMessages(query);
  }

  @RequirePermission('email:manage')
  @Post('messages/:id/retry')
  @HttpCode(HttpStatus.OK)
  retry(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithPrincipal) {
    return this.admin.retry(request.principal!, id, clientIp(request.ip));
  }

  @RequirePermission('email:manage')
  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @RequirePermission('email:manage')
  @Get('suppressions')
  suppressions() {
    return this.admin.listSuppressions();
  }

  @RequirePermission('email:manage')
  @Post('suppressions')
  addSuppression(@Body() body: SuppressionDto, @Req() request: RequestWithPrincipal) {
    return this.admin.addSuppression(request.principal!, body.email, body.note, clientIp(request.ip));
  }

  @RequirePermission('email:manage')
  @Delete('suppressions/:email')
  removeSuppression(@Param('email') email: string, @Req() request: RequestWithPrincipal) {
    return this.admin.removeSuppression(request.principal!, email, clientIp(request.ip));
  }
}
