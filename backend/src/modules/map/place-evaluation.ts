import { createHash } from 'node:crypto';
import {
  CRITERIA,
  CRITERION_GROUPS,
  DEFAULT_WEIGHTS,
  type Confidence,
  type CriterionDefinition,
  type CriterionGroup,
} from './criteria.js';
import { clampScore, round1 } from './scoring.js';

export {
  CRITERIA,
  CRITERION_GROUPS,
  CRITERION_IDS,
  DEFAULT_WEIGHTS,
  INNER_CITY_ANCHOR,
  WEIGHT_MAX,
  WEIGHT_MIN,
  isValidWeight,
  type CriterionDefinition,
  type CriterionGroup,
} from './criteria.js';
export { clampScore, SCORE_MAX, SCORE_MIN } from './scoring.js';

/**
 * Gộp số đo của từng tiêu chí thành kết quả đánh giá (research.md Bản ghi 10 và 14): điểm tổng có trọng số, điểm
 * mạnh/yếu, tiêu chí chưa tính, điều kiện chặn. Số đo do PlaceMeasureService tạo (đo thật trên PostGIS, Vietmap,
 * OpenAQ); tiêu chí cần AI chưa làm thì có số minh họa ổn định theo tọa độ (`mockPendingMeasurement`).
 */

/** Điểm trung tính: trên mốc này là điểm mạnh, từ mốc trở xuống là điểm yếu. */
export const NEUTRAL_SCORE = 5;

/** Điểm tổng tính trên dưới tỷ lệ này (theo trọng số) của tiêu chí đo được thì báo "dữ liệu mỏng". */
export const COVERAGE_MIN = 0.6;

/**
 * - `ok`: đo thật.
 * - `fallback`: đo bằng phương án dự phòng (ví dụ khoảng cách thay thời gian đi khi Vietmap lỗi); độ tin hạ một bậc.
 * - `no_data`: bản phát hành chưa có lớp dữ liệu, hoặc không tìm thấy đối tượng trong bán kính tìm.
 * - `unavailable`: nguồn ngoài chưa cấu hình hoặc đang lỗi (OpenAQ, PostGIS).
 * - `not_implemented`: tiêu chí cần AI, chưa làm; điểm là số minh họa.
 */
export type MeasurementStatus = 'ok' | 'fallback' | 'no_data' | 'unavailable' | 'not_implemented';

/** Đối tượng làm dẫn chứng (để vẽ trên bản đồ): điểm gần nhất, đường gần nhất… */
export interface MeasurementEvidence {
  name: string;
  lat: number;
  lng: number;
  distanceM: number;
  minutes?: number;
  /** Nhóm của lựa chọn (trường: "Mầm non", "Phổ thông"). */
  group?: string;
  /** Số đo tại đối tượng (PM2.5 của trạm) và thời điểm đo. */
  value?: number;
  observedAt?: string;
}

/** Vùng đệm quanh đường (vùng ồn): vòng ngoài các đa giác, [lng, lat]. */
export interface MeasurementZone {
  meters: number;
  rings: Array<Array<[number, number]>>;
}

export interface MeasurementCell {
  lat: number;
  lng: number;
  value: number;
}

/** Kết quả đo tự động của một tiêu chí (chưa gộp chỉnh tay). Lưu nguyên trong `map_place_analyses.measurements`. */
export interface CriterionMeasurement {
  id: string;
  /** Điểm tự động 0–10. Không đo được (`no_data`, `unavailable`) thì bằng mốc trung tính và không tính vào điểm tổng. */
  autoScore: number;
  verdict: string;
  detail: string;
  /** Bản ghi cũ (trước Bản ghi 15) không có các trường dưới đây: coi như `ok`, độ tin `medium`. */
  status?: MeasurementStatus;
  confidence?: Confidence;
  /** Số đo gốc và đơn vị (m, phút, người, %, µg/m³). */
  value?: number | null;
  unit?: string;
  /** `nearest@1`… để biết kết quả tính theo cách nào. */
  method?: string;
  /** Phiên bản lớp đã đọc (nguồn gốc kết quả, AC-07). */
  layerVersions?: string[];
  evidence?: MeasurementEvidence[];
  /** Ô lưới quanh địa điểm (tâm ô và giá trị) để tô trên bản đồ; cỡ ô `cellM` mét. */
  cells?: MeasurementCell[];
  cellM?: number;
  /** Hình dạng đường làm dẫn chứng (đã cắt quanh địa điểm), [lng, lat]. */
  paths?: Array<Array<[number, number]>>;
  zones?: MeasurementZone[];
  /** Bán kính có nghĩa với tiêu chí (bán kính đếm, bán kính lưới) hoặc ngưỡng đạt trọn điểm, để vẽ vòng tròn. */
  radiusM?: number;
  blockingHit?: boolean;
  /** Thời điểm quan sát của nguồn biến động (OpenAQ, Vietmap) và hạn dùng của số đo đó. */
  observedAt?: string;
  expiresAt?: string;
  /** Vì sao không đo được, hoặc giới hạn đã biết. */
  note?: string;
  /** Nguồn theo lớp dữ liệu thực sự đã đọc; thiếu thì dùng nguồn trong định nghĩa tiêu chí. */
  source?: string;
}

export interface CriterionOverride {
  criterionId: string;
  skipped: boolean;
  score: number | null;
}

export interface EvaluatedCriterion {
  id: string;
  label: string;
  group: CriterionGroup;
  groupLabel: string;
  verdict: string;
  detail: string;
  source: string;
  /** Điểm đang dùng (0–10): điểm chỉnh tay nếu có, không thì điểm tự động. */
  score: number;
  autoScore: number;
  manual: boolean;
  skipped: boolean;
  /** Trọng số đang dùng (của người dùng nếu đã đặt, không thì mặc định). */
  weight: number;
  defaultWeight: number;
  status: MeasurementStatus;
  confidence: Confidence;
  /** Có góp vào điểm tổng không (đo được, đủ tin, không bỏ qua, trọng số > 0; hoặc người dùng đã chấm tay). */
  counted: boolean;
  note: string | null;
  blockingHit: boolean;
  evidence: MeasurementEvidence[];
  /** Cách đo (`nearest@1`…): giao diện chọn cách vẽ dẫn chứng theo đây. */
  method: string | null;
  unit: string | null;
  value: number | null;
  cells: MeasurementCell[];
  cellM: number | null;
  radiusM: number | null;
  paths: Array<Array<[number, number]>>;
  zones: MeasurementZone[];
}

export interface EvaluationBlocking {
  criterionId: string;
  label: string;
  message: string;
  cap: number;
}

export interface PlaceEvaluation {
  placeKey: string;
  lat: number;
  lng: number;
  /** true: bản phân tích cũ toàn số minh họa (trước khi đo thật). */
  sample: boolean;
  /** Điểm tổng 0–10: trung bình có trọng số các tiêu chí được tính; null nếu không còn tiêu chí nào. */
  overall: number | null;
  rating: string;
  summary: string;
  strengths: { points: number; items: EvaluatedCriterion[] };
  weaknesses: { points: number; items: EvaluatedCriterion[] };
  /** Tiêu chí có mặt nhưng không vào điểm: chưa có dữ liệu, nguồn lỗi, dữ liệu mỏng, hoặc cần AI chưa làm. */
  pending: EvaluatedCriterion[];
  /** Danh sách tiện tra cứu các tiêu chí đã bỏ qua (cũng có trong strengths/weaknesses). */
  skipped: EvaluatedCriterion[];
  criteriaCount: number;
  /** Tỷ lệ (theo trọng số) tiêu chí đo được trên các tiêu chí đo tự động được; < 0,6 thì điểm tổng chỉ để tham khảo. */
  coverage: number;
  /** Điều kiện chặn đang áp: điểm tổng bị giới hạn ở `cap`. */
  blocking: EvaluationBlocking[];
}

/** Khóa địa điểm: tọa độ làm tròn 5 chữ số (~1 m). Dùng cho cache, chỉnh tay và địa điểm đã lưu. */
export function placeKeyOf(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Điểm chỉnh tay hợp lệ: 0–10, bước 0,5. */
export function normalizeManualScore(value: number): number {
  return clampScore(Math.round(value * 2) / 2);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** PRNG mulberry32 có hạt giống: cùng chuỗi hạt giống cho cùng dãy số. */
function seeded(seed: string): () => number {
  let state = createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PENDING_MOCKS: Readonly<Record<string, (random: () => number) => { score: number; verdict: string; detail: string }>> = {
  'ngap-ung': (random) => {
    const reports = Math.floor(random() * 5);
    return {
      score: round1(clampScore(9 - reports * 2)),
      verdict: reports === 0 ? 'Chưa thấy tin ngập' : reports < 3 ? 'Có tin ngập' : 'Hay ngập',
      detail: `${reports} tin ngập trong 1 km, 3 năm gần đây (số minh họa)`,
    };
  },
  'quy-hoach': (random) => {
    const projects = Math.floor(random() * 4);
    return {
      score: round1(clampScore(5 + projects * 1.2)),
      verdict: projects === 0 ? 'Chưa thấy dự án' : 'Có dự án lân cận',
      detail: `${projects} dự án hạ tầng đã phê duyệt trong 2 km (số minh họa)`,
    };
  },
  'an-ninh': (random) => {
    const incidents = Math.floor(random() * 6);
    return {
      score: round1(clampScore(8.5 - incidents)),
      verdict: incidents <= 1 ? 'Ít tin vụ việc' : 'Có tin vụ việc',
      detail: `${incidents} tin vụ việc trong 1 km, 12 tháng gần đây (số minh họa)`,
    };
  },
};

/**
 * Tiêu chí cần AI chưa làm: số minh họa cụ thể, ổn định theo tọa độ, gắn `not_implemented` để giao diện ghi
 * "Chưa thực hiện" và không tính vào điểm tổng.
 */
export function mockPendingMeasurement(definition: CriterionDefinition, lat: number, lng: number): CriterionMeasurement {
  const random = seeded(`${definition.id}:${placeKeyOf(lat, lng)}`);
  const mock = PENDING_MOCKS[definition.id]?.(random) ?? { score: NEUTRAL_SCORE, verdict: 'Chưa thực hiện', detail: 'Số minh họa' };
  return {
    id: definition.id,
    autoScore: mock.score,
    verdict: mock.verdict,
    detail: mock.detail,
    status: 'not_implemented',
    confidence: 'low',
    value: null,
    method: 'ai_pending@0',
    note: `Tính năng chưa được thực hiện. ${definition.caveat ?? ''}`.trim(),
  };
}

function ratingOf(overall: number | null, coverage: number): string {
  if (overall === null) return 'Chưa đủ tiêu chí';
  // Đo được quá ít tiêu chí: không gắn nhãn "Rất tốt"/"Kém" cho một con số dựa trên vài tiêu chí.
  if (coverage < COVERAGE_MIN) return 'Chỉ tham khảo';
  if (overall >= 8) return 'Rất tốt';
  if (overall >= 6.5) return 'Tốt';
  if (overall >= 5) return 'Trung bình';
  return 'Kém';
}

function joinLabels(items: EvaluatedCriterion[]): string {
  const labels = items.map((item) => item.label.toLowerCase());
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} và ${labels[labels.length - 1]}`;
}

function summarize(
  overall: number | null,
  rating: string,
  strengths: EvaluatedCriterion[],
  weaknesses: EvaluatedCriterion[],
  used: number,
  coverage: number,
  blocking: EvaluationBlocking[],
): string {
  if (overall === null) {
    return 'Chưa có tiêu chí nào đo được và được tính (thiếu dữ liệu, đã bỏ qua hoặc trọng số 0) nên chưa có nhận xét.';
  }
  const top = strengths.slice(0, 3);
  const low = [...weaknesses].sort((a, b) => a.score - b.score).slice(0, 3);
  const parts: string[] = [];
  if (blocking.length > 0) parts.push(`${blocking[0].message} Điểm tổng bị giới hạn ở ${formatNumber(blocking[0].cap, 1)}.`);
  parts.push(
    coverage < COVERAGE_MIN
      ? `Điểm ${overall.toFixed(1).replace('.', ',')}/10 tính trên ${used} tiêu chí đo được.`
      : `Điểm ${overall.toFixed(1).replace('.', ',')}/10, mức ${rating.toLowerCase()} trên ${used} tiêu chí.`,
  );
  if (top.length > 0) parts.push(`Nổi bật ở ${joinLabels(top)}.`);
  if (low.length > 0) parts.push(`Cần cân nhắc ${joinLabels(low)}.`);
  if (coverage < COVERAGE_MIN) parts.push('Dữ liệu còn mỏng, điểm tổng chỉ để tham khảo.');
  return parts.join(' ');
}

/** Có tính vào điểm tổng được không khi người dùng chưa chấm tay: đo thật và đủ tin (từ `medium`). */
function measuredAndTrusted(status: MeasurementStatus, confidence: Confidence): boolean {
  return (status === 'ok' || status === 'fallback') && confidence !== 'low';
}

/** Gộp số đo tự động với chỉnh tay của người dùng, chia điểm mạnh/yếu và tính điểm tổng. */
export function buildEvaluation(
  lat: number,
  lng: number,
  measurements: CriterionMeasurement[],
  overrides: CriterionOverride[],
  sample = false,
  /** Trọng số riêng của người dùng theo mã tiêu chí; thiếu thì dùng DEFAULT_WEIGHTS. */
  weights: ReadonlyMap<string, number> = new Map(),
): PlaceEvaluation {
  const byId = new Map(overrides.map((item) => [item.criterionId, item]));
  const evaluated: EvaluatedCriterion[] = [];
  for (const definition of CRITERIA) {
    const measured = measurements.find((item) => item.id === definition.id);
    if (!measured) continue;
    const override = byId.get(definition.id);
    const manual = override?.score !== null && override?.score !== undefined;
    const status = measured.status ?? 'ok';
    const confidence = measured.confidence ?? 'medium';
    const skipped = override?.skipped === true;
    const weight = weights.get(definition.id) ?? DEFAULT_WEIGHTS[definition.id] ?? 1;
    // Điểm chấm tay luôn được tính (người dùng tự lấp chỗ hệ thống chưa đo được), số minh họa thì không.
    const counted = !skipped && weight > 0 && (manual || measuredAndTrusted(status, confidence));
    evaluated.push({
      id: definition.id,
      label: definition.label,
      group: definition.group,
      groupLabel: CRITERION_GROUPS[definition.group],
      verdict: measured.verdict,
      detail: measured.detail,
      source: measured.source ?? definition.source,
      score: manual ? normalizeManualScore(override.score as number) : measured.autoScore,
      autoScore: measured.autoScore,
      manual,
      skipped,
      weight,
      defaultWeight: DEFAULT_WEIGHTS[definition.id] ?? 1,
      status,
      confidence,
      counted,
      note: measured.note ?? (confidence === 'low' && status === 'ok' ? (definition.caveat ?? 'Dữ liệu mỏng.') : null),
      blockingHit: measured.blockingHit === true,
      evidence: measured.evidence ?? [],
      method: measured.method ?? null,
      unit: measured.unit ?? null,
      value: measured.value ?? null,
      cells: measured.cells ?? [],
      cellM: measured.cellM ?? null,
      radiusM: measured.radiusM ?? null,
      paths: measured.paths ?? [],
      zones: measured.zones ?? [],
    });
  }

  const active = evaluated.filter((item) => item.counted);
  // Trọng số dùng cho điểm mạnh/yếu: mọi trọng số bằng nhau thì bằng tổng chênh lệch so với mốc 5.
  const totalWeight = active.reduce((sum, item) => sum + item.weight, 0);
  const meanWeight = active.length > 0 ? totalWeight / active.length : 1;
  let overall = totalWeight > 0 ? round1(active.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight) : null;

  const blocking: EvaluationBlocking[] = [];
  for (const item of active) {
    const rule = CRITERIA.find((definition) => definition.id === item.id)?.blocking;
    if (!rule || !item.blockingHit || item.manual) continue;
    blocking.push({ criterionId: item.id, label: item.label, message: rule.message, cap: rule.cap });
  }
  if (overall !== null && blocking.length > 0) overall = Math.min(overall, ...blocking.map((item) => item.cap));

  // Độ phủ: chỉ xét tiêu chí đo tự động được (bỏ tiêu chí AI chưa làm và tiêu chí người dùng đã bỏ/đặt trọng số 0).
  const automatic = evaluated.filter((item) => item.status !== 'not_implemented' && !item.skipped && item.weight > 0);
  const automaticWeight = automatic.reduce((sum, item) => sum + item.weight, 0);
  const measuredWeight = automatic.filter((item) => item.counted).reduce((sum, item) => sum + item.weight, 0);
  const coverage = automaticWeight > 0 ? Math.round((measuredWeight / automaticWeight) * 100) / 100 : 0;

  // Tiêu chí bỏ qua vẫn nằm trong nhóm điểm của nó (giao diện gạch ngang). Tiêu chí không đo được hoặc chưa làm
  // thì vào `pending` để không lẫn số minh họa với kết luận thật.
  const placed = evaluated.filter((item) => item.counted || item.skipped);
  const pending = evaluated.filter((item) => !item.counted && !item.skipped);
  const strengths = placed.filter((item) => item.score > NEUTRAL_SCORE).sort((a, b) => b.score - a.score);
  const weaknesses = placed.filter((item) => item.score <= NEUTRAL_SCORE).sort((a, b) => a.score - b.score);
  const counted = (items: EvaluatedCriterion[]): EvaluatedCriterion[] => items.filter((item) => item.counted);
  const pointsOf = (items: EvaluatedCriterion[]): number =>
    round1(counted(items).reduce((sum, item) => sum + Math.abs(item.score - NEUTRAL_SCORE) * item.weight, 0) / meanWeight);
  const rating = ratingOf(overall, coverage);
  return {
    placeKey: placeKeyOf(lat, lng),
    lat,
    lng,
    sample,
    overall,
    rating,
    summary: summarize(overall, rating, counted(strengths), counted(weaknesses), active.length, coverage, blocking),
    strengths: { points: pointsOf(strengths), items: strengths },
    weaknesses: { points: pointsOf(weaknesses), items: weaknesses },
    pending,
    skipped: evaluated.filter((item) => item.skipped),
    criteriaCount: evaluated.length,
    coverage,
    blocking,
  };
}
