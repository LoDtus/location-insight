import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { ApiErrorDto } from '../../shared/dtos/response/api-error.dto.js';
import { ApiResponseDto } from '../../shared/dtos/response/api-response.dto.js';
import { toUtcIsoString } from '../../shared/utils/iso-date.util.js';
import { isHealthUrl } from '../../shared/utils/runtime.util.js';

const ERROR_CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
};

type ExceptionBody = {
  message?: string | string[];
  code?: ErrorCode;
  details?: unknown;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: { id?: string } }>();
    const traceId = this.readTraceId();

    if (isHealthUrl(request.originalUrl || request.url || '')) {
      if (exception instanceof HttpException) {
        response.status(exception.getStatus()).json(exception.getResponse());
        return;
      }
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã có lỗi hệ thống xảy ra. Vui lòng thử lại sau.';
    const apiError: ApiErrorDto = {
      code: ErrorCode.INTERNAL_ERROR,
      details: null,
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionBody = exception.getResponse();
      apiError.code = ERROR_CODE_BY_STATUS[status] ?? ErrorCode.INTERNAL_ERROR;

      if (typeof exceptionBody === 'string') {
        message = exceptionBody;
      } else if (exceptionBody && typeof exceptionBody === 'object') {
        const body = exceptionBody as ExceptionBody;
        apiError.code = body.code ?? apiError.code;
        apiError.details = body.details ?? null;

        if (Array.isArray(body.message)) {
          message = 'Dữ liệu gửi lên không hợp lệ.';
          apiError.details = body.details ?? body.message;
        } else if (body.message) {
          message = body.message;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${exception.message}`,
        exception.stack,
      );

      if (process.env.NODE_ENV !== 'production') {
        message = exception.message || message;
        apiError.details = { stack: exception.stack };
      }
    }

    if (traceId) {
      response.setHeader('x-trace-id', traceId);
    }

    response.status(status).json(
      new ApiResponseDto({
        timestamp: toUtcIsoString(new Date()),
        success: false,
        status,
        message,
        error: apiError,
        traceId,
      }),
    );
  }

  private readTraceId(): string | undefined {
    try {
      return this.cls.getId();
    } catch {
      return undefined;
    }
  }
}
