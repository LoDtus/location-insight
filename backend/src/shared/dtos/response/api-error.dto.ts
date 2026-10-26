import { ErrorCode } from '../../constants/error-code.constant.js';

export class ApiErrorDto {
  code?: ErrorCode;
  message?: string;
  details?: unknown;
}
