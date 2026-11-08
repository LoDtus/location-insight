/**
 * Mốc thời gian cho biểu đồ "Số bài đã đăng" (giờ Việt Nam). Khóa mốc: ngày "YYYY-MM-DD", tháng "YYYY-MM", năm "YYYY".
 */
export type FrequencyGrain = 'day' | 'month' | 'year';

export const FREQUENCY_PATTERN = { day: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' } as const;
export const FREQUENCY_LIMIT = { day: 400, month: 60, year: 30 } as const;
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const KEY_PATTERN: Record<FrequencyGrain, RegExp> = {
  day: /^\d{4}-\d{2}-\d{2}$/,
  month: /^\d{4}-\d{2}$/,
  year: /^\d{4}$/,
};

export function isBucketKey(grain: FrequencyGrain, key: string): boolean {
  if (!KEY_PATTERN[grain].test(key)) return false;
  if (grain === 'year') return true;
  const [year, month, day = 1] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Ngày (giờ VN) của một thời điểm, dạng YYYY-MM-DD. */
export function vnDayKey(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Mốc chứa một ngày theo đơn vị: 2026-11-08 → tháng 2026-11, năm 2026. */
export function bucketOfDay(grain: FrequencyGrain, dayKey: string): string {
  if (grain === 'year') return dayKey.slice(0, 4);
  if (grain === 'month') return dayKey.slice(0, 7);
  return dayKey;
}

/** Thời điểm bắt đầu mốc (00:00 giờ VN). */
export function zonedStart(grain: FrequencyGrain, key: string): Date {
  if (grain === 'year') return new Date(`${key}-01-01T00:00:00+07:00`);
  if (grain === 'month') return new Date(`${key}-01T00:00:00+07:00`);
  return new Date(`${key}T00:00:00+07:00`);
}

export function nextBucket(grain: FrequencyGrain, key: string): string {
  if (grain === 'year') return String(Number(key) + 1);
  if (grain === 'month') {
    const [year, month] = key.split('-').map(Number);
    if (month === 12) return `${year + 1}-01`;
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Danh sách mốc liên tiếp from..to (gồm cả hai đầu), tối đa `limit` mốc. */
export function bucketRange(grain: FrequencyGrain, from: string, to: string, limit: number): string[] | null {
  const keys: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    keys.push(cursor);
    if (keys.length > limit) return null;
    cursor = nextBucket(grain, cursor);
  }
  return keys;
}
