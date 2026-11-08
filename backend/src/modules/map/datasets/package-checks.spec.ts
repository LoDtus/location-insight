import { rowCountDeltaChecks } from './package-checks.js';
import type { DiffSummary } from './datasets.types.js';

function diff(baseRowCount: number | null, rowCount: number, byCategory: DiffSummary['byCategory'] = {}): DiffSummary {
  return { baseLayerVersionId: baseRowCount === null ? null : 'v1', baseRowCount, rowCount, added: null, removed: null, byCategory };
}

function statusOf(code: string, checks: ReturnType<typeof rowCountDeltaChecks>): string | undefined {
  return checks.find((item) => item.code === code)?.status;
}

describe('rowCountDeltaChecks (data-change-playbook.md tình huống 14)', () => {
  it('lần nhập đầu không có gì để so thì đạt', () => {
    const checks = rowCountDeltaChecks(diff(null, 100));
    expect(checks.every((item) => item.status === 'pass')).toBe(true);
  });

  it('lệch dưới 5% đạt cả hai mức', () => {
    const checks = rowCountDeltaChecks(diff(1000, 1040));
    expect(statusOf('row_count_delta', checks)).toBe('pass');
    expect(statusOf('row_count_delta_warn', checks)).toBe('pass');
  });

  it('lệch 10% chỉ cảnh báo', () => {
    const checks = rowCountDeltaChecks(diff(1000, 900));
    expect(statusOf('row_count_delta', checks)).toBe('pass');
    expect(statusOf('row_count_delta_warn', checks)).toBe('fail');
  });

  it('lệch 30% thì chặn', () => {
    expect(statusOf('row_count_delta', rowCountDeltaChecks(diff(1000, 700)))).toBe('fail');
  });

  it('một category mất 40% thì chặn dù tổng chỉ lệch ít', () => {
    const checks = rowCountDeltaChecks(diff(1000, 980, { bus_stop: { before: 100, after: 60 }, market: { before: 900, after: 920 } }));
    expect(statusOf('row_count_delta', checks)).toBe('fail');
  });

  it('category quá nhỏ (dưới 20) không làm chặn', () => {
    const checks = rowCountDeltaChecks(diff(1000, 1000, { hardware: { before: 10, after: 2 } }));
    expect(statusOf('row_count_delta', checks)).toBe('pass');
  });
});
