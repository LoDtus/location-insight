import type { Scoring } from './criteria.js';

/**
 * Quy số đo ra điểm 0–10 (research.md Bản ghi 15).
 *
 * - `decay`: giảm mượt theo smoothstep giữa `good` và `bad`. Trọn điểm trong ngưỡng tốt (như Walk Score cho trọn
 *   điểm trong 5 phút đi bộ), về 0 ở ngưỡng xấu, không gãy khúc như nội suy tuyến tính kẹp hai đầu, nên lệch vài
 *   mét quanh ngưỡng không làm điểm nhảy. Hai đầu phẳng giống hàm logistic mà Walkable Accessibility Score
 *   (kcredit/Walkable-Accessibility-Score) dùng, nhưng có ngưỡng 0 và 10 rõ để giải thích.
 * - `saturate`: lợi ích giảm dần theo số lượng (quán thứ 20 không đáng bằng quán thứ 2): 10·(1 − 2^(−n/half)).
 * - `peak`: tốt nhất ở `optimum`, giảm theo hình chuông: 10·2^(−((x − optimum)/tolerance)²).
 */
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampScore(value: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, value));
}

/** 10 tại `good`, 0 tại `bad`, mượt (đạo hàm 0) ở hai ngưỡng. Hai chiều đều được. */
export function decayScore(value: number, good: number, bad: number): number {
  if (good === bad) return SCORE_MAX / 2;
  const t = Math.min(1, Math.max(0, (value - good) / (bad - good)));
  return round1(SCORE_MAX * (1 - t * t * (3 - 2 * t)));
}

export function saturateScore(amount: number, half: number): number {
  if (half <= 0 || amount <= 0) return 0;
  return round1(clampScore(SCORE_MAX * (1 - 2 ** (-amount / half))));
}

export function peakScore(value: number, optimum: number, tolerance: number): number {
  if (tolerance <= 0) return value === optimum ? SCORE_MAX : 0;
  return round1(SCORE_MAX * 2 ** -(((value - optimum) / tolerance) ** 2));
}

export function scoreOf(value: number, scoring: Scoring): number {
  switch (scoring.curve) {
    case 'decay':
      return decayScore(value, scoring.good, scoring.bad);
    case 'saturate':
      return saturateScore(value, scoring.half);
    case 'peak':
      return peakScore(value, scoring.optimum, scoring.tolerance);
  }
}

/** Trừ hao tuyến tính theo khoảng cách (decay 'linear' của pandana): 1 tại chỗ, 0 ở rìa bán kính. */
export function linearDistanceWeight(distanceM: number, radiusM: number): number {
  return radiusM <= 0 ? 0 : Math.max(0, 1 - distanceM / radiusM);
}

/** Trung vị (mảng rỗng → null). */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
