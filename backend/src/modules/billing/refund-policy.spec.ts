import { describe, expect, it } from 'vitest';
import {
  REFUND_WINDOW_MS,
  evaluateRefund,
  isWholeOrderReason,
  maskAccountNumber,
  type RefundOrderSnapshot,
} from './refund-policy.js';

const now = new Date('2026-11-08T10:00:00Z');
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000);

function order(overrides: Partial<RefundOrderSnapshot> = {}): RefundOrderSnapshot {
  return {
    status: 'paid',
    amountVnd: 600_000,
    receivedVnd: 600_000,
    paidAt: hoursAgo(2),
    benefitUsedAt: null,
    ...overrides,
  };
}

describe('evaluateRefund', () => {
  it('AC-06: chưa dùng quyền lợi và chưa quá 24 giờ thì hoàn đủ số đã nhận', () => {
    expect(
      evaluateRefund({ reason: 'within_24h', order: order(), alreadyRequestedVnd: 0, now }),
    ).toEqual({ ok: true, amountVnd: 600_000 });
  });

  it('AC-06: đã dùng quyền lợi thì từ chối lý do 24 giờ', () => {
    expect(
      evaluateRefund({
        reason: 'within_24h',
        order: order({ benefitUsedAt: hoursAgo(1) }),
        alreadyRequestedVnd: 0,
        now,
      }),
    ).toEqual({ ok: false, denial: 'benefit_used' });
  });

  it('quá 24 giờ thì từ chối lý do 24 giờ, đúng 24 giờ vẫn được', () => {
    const late = order({ paidAt: new Date(now.getTime() - REFUND_WINDOW_MS - 1) });
    expect(
      evaluateRefund({ reason: 'within_24h', order: late, alreadyRequestedVnd: 0, now }),
    ).toEqual({ ok: false, denial: 'window_closed' });
    const edge = order({ paidAt: new Date(now.getTime() - REFUND_WINDOW_MS) });
    expect(
      evaluateRefund({ reason: 'within_24h', order: edge, alreadyRequestedVnd: 0, now }).ok,
    ).toBe(true);
  });

  it('đơn chưa trả hoặc chờ đối soát thì không hoàn được', () => {
    for (const status of ['pending', 'expired', 'canceled', 'needs_review'] as const) {
      expect(
        evaluateRefund({
          reason: 'service_outage',
          order: order({ status }),
          alreadyRequestedVnd: 0,
          now,
        }),
      ).toEqual({ ok: false, denial: 'order_not_paid' });
    }
  });

  it('BR-03: chuyển thừa thì chỉ hoàn phần thừa', () => {
    expect(
      evaluateRefund({
        reason: 'overpay',
        order: order({ receivedVnd: 650_000 }),
        alreadyRequestedVnd: 0,
        now,
      }),
    ).toEqual({ ok: true, amountVnd: 50_000 });
  });

  it('không có phần thừa thì từ chối lý do overpay', () => {
    expect(
      evaluateRefund({ reason: 'overpay', order: order(), alreadyRequestedVnd: 0, now }),
    ).toEqual({ ok: false, denial: 'no_overpay' });
  });

  it('lý do do hệ thống hoàn đúng giá đơn và để admin xét', () => {
    for (const reason of ['service_outage', 'operator_stop', 'duplicate_or_wrong', 'legal'] as const) {
      expect(
        evaluateRefund({ reason, order: order({ paidAt: hoursAgo(500) }), alreadyRequestedVnd: 0, now }),
      ).toEqual({ ok: true, amountVnd: 600_000 });
    }
  });

  it('tổng các yêu cầu chưa bị từ chối không vượt số đã nhận', () => {
    expect(
      evaluateRefund({
        reason: 'service_outage',
        order: order(),
        alreadyRequestedVnd: 50_000,
        now,
      }),
    ).toEqual({ ok: false, denial: 'exceeds_received' });
    expect(
      evaluateRefund({
        reason: 'overpay',
        order: order({ receivedVnd: 650_000 }),
        alreadyRequestedVnd: 600_000,
        now,
      }).ok,
    ).toBe(true);
  });
});

describe('isWholeOrderReason', () => {
  it('chỉ overpay không thu hồi quyền lợi', () => {
    expect(isWholeOrderReason('overpay')).toBe(false);
    expect(isWholeOrderReason('within_24h')).toBe(true);
    expect(isWholeOrderReason('legal')).toBe(true);
  });
});

describe('maskAccountNumber', () => {
  it('chỉ lộ 4 số cuối', () => {
    expect(maskAccountNumber('0123456789')).toBe('••••••6789');
    expect(maskAccountNumber('1234')).toBe('1234');
    expect(maskAccountNumber(null)).toBeNull();
  });
});
