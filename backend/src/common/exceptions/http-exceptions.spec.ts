import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { BusinessException } from './business.exception.js';
import { NotFoundException } from './not-found.exception.js';

describe('http exceptions', () => {
  it('puts the error code on a business exception', () => {
    const exception = new BusinessException(
      ErrorCode.CONFLICT,
      'Tin đã tồn tại',
      { id: '1' },
      HttpStatus.CONFLICT,
    );

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toMatchObject({
      code: ErrorCode.CONFLICT,
      message: 'Tin đã tồn tại',
      details: { id: '1' },
    });
  });

  it('uses not found for a missing record', () => {
    const exception = new NotFoundException();

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});
