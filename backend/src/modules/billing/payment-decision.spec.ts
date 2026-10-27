import { describe, expect, it } from 'vitest';
import { decideIncoming, PaymentOrderSnapshot } from './payment-decision.js';

const now = new Date('2026-10-27T06:00:00.000Z');

function order(
  patch: Partial<PaymentOrderSnapshot> = {},
): PaymentOrderSnapshot {
  return {
    status: 'pending',
    amountVnd: 60_000,
    expiresAt: new Date('2026-10-27T06:30:00.000Z'),
    ...patch,
  };
}

describe('decideIncoming', () => {
  it('bỏ qua tiền ra', () => {
    expect(
      decideIncoming({
        transferType: 'out',
        code: 'DT3F9A12BC',
        order: order(),
        transferAmount: 60_000,
        accountMatches: true,
        now,
      }),
    ).toBe('ignored');
  });

  it('không ghép khi thiếu mã hoặc không có đơn', () => {
    expect(
      decideIncoming({
        transferType: 'in',
        code: null,
        order: order(),
        transferAmount: 60_000,
        accountMatches: true,
        now,
      }),
    ).toBe('unmatched');
  });

  it('mở quyền khi một giao dịch vào đủ tiền', () => {
    expect(
      decideIncoming({
        transferType: 'in',
        code: 'DT3F9A12BC',
        order: order(),
        transferAmount: 60_000,
        accountMatches: true,
        now,
      }),
    ).toBe('fulfilled');
  });

  it('giữ chờ khi thiếu tiền', () => {
    expect(
      decideIncoming({
        transferType: 'in',
        code: 'DT3F9A12BC',
        order: order(),
        transferAmount: 20_000,
        accountMatches: true,
        now,
      }),
    ).toBe('underpaid');
  });

  it('đưa vào đối soát khi đến muộn hoặc sai tài khoản', () => {
    expect(
      decideIncoming({
        transferType: 'in',
        code: 'DT3F9A12BC',
        order: order({ expiresAt: new Date('2026-10-27T05:00:00.000Z') }),
        transferAmount: 60_000,
        accountMatches: true,
        now,
      }),
    ).toBe('late');
    expect(
      decideIncoming({
        transferType: 'in',
        code: 'DT3F9A12BC',
        order: order(),
        transferAmount: 60_000,
        accountMatches: false,
        now,
      }),
    ).toBe('needs_review');
  });
});
