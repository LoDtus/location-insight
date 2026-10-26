import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';

export class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        code,
        message,
        details: details ?? null,
      },
      status,
    );
    this.name = 'BusinessException';
  }
}
