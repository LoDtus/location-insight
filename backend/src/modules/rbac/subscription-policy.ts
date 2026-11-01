export const DOWNGRADE_MESSAGE =
  'Gói hiện tại còn hạn. Hãy đợi hết hạn rồi mới chọn gói thấp hơn.';

export const GRANT_BLOCKED_MESSAGE =
  'Người này đang còn gói. Hãy kết thúc gói đó trước khi cấp gói mới.';

export type PaidPlan = 'unlimited' | 'valued';
export type PlanChange = 'open' | 'extend' | 'upgrade' | 'reject';

export function decidePlanChange(
  current: PaidPlan | null,
  next: PaidPlan,
): PlanChange {
  if (!current) return 'open';
  if (current === next) return 'extend';
  if (current === 'unlimited' && next === 'valued') return 'upgrade';
  return 'reject';
}
