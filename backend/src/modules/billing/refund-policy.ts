export const REFUND_REASONS = [
  'within_24h',
  'service_outage',
  'operator_stop',
  'duplicate_or_wrong',
  'overpay',
  'legal',
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number];

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'paid_out';

export const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Lý do hoàn cả đơn: duyệt thì thu hồi gói hoặc trừ tín dụng.
 * `overpay` chỉ hoàn phần thừa; `service_outage` hoàn một phần theo thời gian gián đoạn và gói vẫn chạy.
 */
export function isWholeOrderReason(reason: RefundReason): boolean {
  return reason !== 'overpay' && reason !== 'service_outage';
}

/** Lý do mà số tiền hoàn tính theo tỷ lệ thời gian hoặc theo yêu cầu pháp luật, nên admin được nhập số nhỏ hơn mức trần khi duyệt. */
export function canAdjustRefundAmount(reason: RefundReason): boolean {
  return (
    reason === 'service_outage' ||
    reason === 'operator_stop' ||
    reason === 'legal'
  );
}

export interface RefundOrderSnapshot {
  status: 'pending' | 'paid' | 'expired' | 'canceled' | 'needs_review';
  amountVnd: number;
  receivedVnd: number;
  paidAt: Date | null;
  benefitUsedAt: Date | null;
}

export type RefundDenial =
  | 'order_not_paid'
  | 'window_closed'
  | 'benefit_used'
  | 'no_overpay'
  | 'exceeds_received';

export type RefundEvaluation =
  | { ok: true; amountVnd: number }
  | { ok: false; denial: RefundDenial };

export const REFUND_DENIAL_MESSAGE: Record<RefundDenial, string> = {
  order_not_paid: 'Chỉ xin hoàn được đơn đã thanh toán.',
  window_closed: 'Đã quá 24 giờ kể từ lúc thanh toán nên không hoàn theo lý do này.',
  benefit_used:
    'Bạn đã dùng quyền lợi của đơn này nên không hoàn theo lý do trong 24 giờ.',
  no_overpay: 'Đơn này không có khoản chuyển thừa.',
  exceeds_received: 'Số tiền xin hoàn vượt quá số đã nhận hoặc đã có yêu cầu hoàn cho đơn này.',
};

/**
 * Quyết định một yêu cầu hoàn có hợp lệ không và số tiền là bao nhiêu.
 * `alreadyRequestedVnd` là tổng các yêu cầu hoàn chưa bị từ chối của cùng đơn.
 */
export function evaluateRefund(input: {
  reason: RefundReason;
  order: RefundOrderSnapshot;
  alreadyRequestedVnd: number;
  now: Date;
}): RefundEvaluation {
  const { reason, order, alreadyRequestedVnd, now } = input;
  if (order.status !== 'paid') return { ok: false, denial: 'order_not_paid' };

  let amountVnd: number;
  if (reason === 'within_24h') {
    const paidAt = order.paidAt?.getTime();
    if (paidAt === undefined || now.getTime() - paidAt > REFUND_WINDOW_MS) {
      return { ok: false, denial: 'window_closed' };
    }
    if (order.benefitUsedAt) return { ok: false, denial: 'benefit_used' };
    amountVnd = order.receivedVnd;
  } else if (reason === 'overpay') {
    amountVnd = order.receivedVnd - order.amountVnd;
    if (amountVnd <= 0) return { ok: false, denial: 'no_overpay' };
  } else {
    amountVnd = order.amountVnd;
  }

  if (amountVnd <= 0 || alreadyRequestedVnd + amountVnd > order.receivedVnd) {
    return { ok: false, denial: 'exceeds_received' };
  }
  return { ok: true, amountVnd };
}

/** Chỉ giữ 4 số cuối để API của chủ đơn không trả lại số tài khoản đầy đủ. */
export function maskAccountNumber(value: string | null): string | null {
  if (!value) return null;
  const tail = value.slice(-4);
  return `${'•'.repeat(Math.max(value.length - 4, 0))}${tail}`;
}
