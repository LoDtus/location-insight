import {
  Controller,
  HttpCode,
  Post,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import {
  Public,
  RATE_LIMIT_KEY,
} from '../common/decorators/access.decorator.js';
import { DevResetGuard } from './dev-reset.guard.js';
import { DevResetResult, DevResetService } from './dev-reset.service.js';

/**
 * Chỉ tồn tại khi `registerDevReset()` trả module (xem dev-reset.module.ts).
 * `@Public()` vì sau khi xóa không còn phiên đăng nhập; thay bằng `DevResetGuard` (token + mạng nội bộ).
 * Metadata `refresh` chỉ để qua kiểm kê route (không áp giới hạn auth); giới hạn thật nằm ở service.
 */
@Controller('dev/reset')
@Public()
@UseGuards(DevResetGuard)
export class DevResetController {
  constructor(private readonly reset: DevResetService) {}

  @Post()
  @HttpCode(200)
  @SetMetadata(RATE_LIMIT_KEY, 'refresh')
  run(): Promise<DevResetResult> {
    return this.reset.run();
  }
}
