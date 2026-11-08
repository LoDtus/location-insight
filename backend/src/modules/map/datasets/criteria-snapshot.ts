import { createHash } from 'node:crypto';
import { CRITERIA, DEFAULT_WEIGHTS } from '../place-evaluation.js';

/**
 * Bản chụp định nghĩa tiêu chí trong code lúc phát hành (research.md Bản ghi 9). Đánh giá theo bản đã ghim dùng
 * bản chụp này, không dùng hằng số đang chạy. Khi tiêu chí có `inputs`, `methodVersion`… (Bản ghi 14) thì các
 * trường đó tự vào bản chụp vì lấy nguyên định nghĩa.
 */
export interface CriterionSnapshotItem {
  id: string;
  definition: unknown;
  defaultWeight: number | null;
}

export type CriterionChange = 'added' | 'removed' | 'changed';

export function buildCriteriaSnapshot(): CriterionSnapshotItem[] {
  return CRITERIA.map((item) => ({
    id: item.id,
    definition: item,
    defaultWeight: DEFAULT_WEIGHTS[item.id] ?? null,
  }));
}

/** JSON với khóa object sắp xếp, để cùng nội dung luôn ra cùng chuỗi. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashCriteriaSnapshot(snapshot: readonly CriterionSnapshotItem[]): string {
  return createHash('sha256').update(canonicalJson(snapshot)).digest('hex');
}

function isSnapshotItem(value: unknown): value is CriterionSnapshotItem {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

/** So bản chụp mới (code) với bản chụp của bản hiện hành: tiêu chí thêm, bỏ, đổi. */
export function diffCriteria(previous: readonly unknown[], next: readonly CriterionSnapshotItem[]): Array<{ criterionId: string; change: CriterionChange }> {
  const before = new Map(previous.filter(isSnapshotItem).map((item) => [item.id, canonicalJson(item)]));
  const after = new Map(next.map((item) => [item.id, canonicalJson(item)]));
  const changes: Array<{ criterionId: string; change: CriterionChange }> = [];
  for (const [id, text] of after) {
    const old = before.get(id);
    if (old === undefined) changes.push({ criterionId: id, change: 'added' });
    else if (old !== text) changes.push({ criterionId: id, change: 'changed' });
  }
  for (const id of before.keys()) {
    if (!after.has(id)) changes.push({ criterionId: id, change: 'removed' });
  }
  return changes;
}
