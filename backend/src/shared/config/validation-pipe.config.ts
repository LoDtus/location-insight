import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ErrorCode } from '../constants/error-code.constant.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';

export const configureValidationPipe = (app: INestApplication): void => {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        const details = flattenValidationErrors(validationErrors);
        return new BusinessException(
          ErrorCode.VALIDATION_ERROR,
          'Dữ liệu gửi lên không hợp lệ.',
          details,
        );
      },
    }),
  );
};

function flattenValidationErrors(
  validationErrors: ValidationError[],
  parent = '',
): Record<string, string[]> {
  return validationErrors.reduce<Record<string, string[]>>((acc, error) => {
    const key = parent ? `${parent}.${error.property}` : error.property;

    if (error.constraints) {
      acc[key] = Object.values(error.constraints);
    }

    if (error.children && error.children.length > 0) {
      Object.assign(acc, flattenValidationErrors(error.children, key));
    }

    return acc;
  }, {});
}
