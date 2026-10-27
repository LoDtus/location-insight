export type PaymentApplyResult =
  | 'ignored'
  | 'underpaid'
  | 'fulfilled'
  | 'late'
  | 'unmatched'
  | 'needs_review';

export interface PaymentOrderSnapshot {
  status: 'pending' | 'paid' | 'expired' | 'canceled' | 'needs_review';
  amountVnd: number;
  expiresAt: Date;
}

export function decideIncoming(input: {
  transferType: 'in' | 'out';
  code: string | null;
  order: PaymentOrderSnapshot | null;
  transferAmount: number;
  accountMatches: boolean;
  now: Date;
}): PaymentApplyResult {
  if (input.transferType === 'out') return 'ignored';
  if (!input.code || !input.order) return 'unmatched';
  if (input.order.status === 'paid') return 'needs_review';
  if (
    input.order.status === 'expired' ||
    input.order.status === 'canceled' ||
    input.order.status === 'needs_review' ||
    input.order.expiresAt.getTime() <= input.now.getTime()
  ) {
    return 'late';
  }
  if (!input.accountMatches) return 'needs_review';
  if (input.transferAmount < input.order.amountVnd) return 'underpaid';
  return 'fulfilled';
}
