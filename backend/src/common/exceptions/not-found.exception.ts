import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';

export class NotFoundException extends HttpException {
  constructor(
    message = 'Không tìm thấy dữ liệu.',
    public readonly details?: unknown,
  ) {
    super(
      {
        code: ErrorCode.NOT_FOUND,
        message,
        details: details ?? null,
      },
      HttpStatus.NOT_FOUND,
    );
    this.name = 'NotFoundException';
  }
}
