import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { CANNOT_MESSAGE } from './messaging.constants.js';

export function notFound(message = 'Không tìm thấy.'): never {
  throw new BusinessException(ErrorCode.NOT_FOUND, message, null, HttpStatus.NOT_FOUND);
}

export function invalid(message: string, details?: unknown): never {
  throw new BusinessException(
    ErrorCode.VALIDATION_ERROR,
    message,
    details,
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export function conflict(message: string, code: ErrorCode = ErrorCode.CONFLICT): never {
  throw new BusinessException(code, message, null, HttpStatus.CONFLICT);
}

export function forbidden(message: string): never {
  throw new BusinessException(
    ErrorCode.PERMISSION_DENIED,
    message,
    null,
    HttpStatus.FORBIDDEN,
  );
}

/** Dùng chung cho chặn và "không ai được nhắn": không lộ lý do (I2). */
export function cannotMessage(): never {
  throw new BusinessException(
    ErrorCode.PERMISSION_DENIED,
    CANNOT_MESSAGE,
    { code: 'cannot_message_user' },
    HttpStatus.FORBIDDEN,
  );
}

export function requestPending(): never {
  throw new BusinessException(
    ErrorCode.CONFLICT,
    'Bạn có thể nhắn thêm sau khi người này chấp nhận.',
    { code: 'request_pending' },
    HttpStatus.CONFLICT,
  );
}

export function tooMany(retryAfter: number): never {
  throw new BusinessException(
    ErrorCode.TOO_MANY_REQUESTS,
    'Bạn thao tác hơi nhanh. Hãy đợi một chút rồi thử lại.',
    { retryAfter },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

export function unavailable(): never {
  throw new BusinessException(
    ErrorCode.SERVICE_UNAVAILABLE,
    'Chưa ghi được lúc này. Hãy thử lại.',
    null,
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
