import { createHash } from 'node:crypto';
import { haversineM } from './map.mapper.js';

/**
 * Đánh giá địa điểm (giai đoạn mock). Bộ tiêu chí lấy đúng theo workspace/features/000-ideas/tieu-chi.md
 * ("Hệ thống tự tính từ ghim"). Số liệu sinh ổn định theo tọa độ (cùng điểm → cùng kết quả) và luôn gắn
 * cờ `sample: true`; riêng "Nội đô" là số thật (khoảng cách tới Hồ Gươm). Khi có PostGIS/AI, chỉ cần thay
 * `generateCriteria` bằng truy vấn thật, phần gộp điểm và chỉnh tay giữ nguyên.
 */

export const CRITERION_GROUPS = {
  walk: 'Tiện ích đi bộ 500 m',
  move: 'Đi lại và đường',
  health: 'Y tế',
  env: 'Dân cư, môi trường, địa hình',
} as const;
export type CriterionGroup = keyof typeof CRITERION_GROUPS;

/** Mốc nội đô theo tiêu chí: Hồ Gươm. */
export const INNER_CITY_ANCHOR = { lat: 21.0285, lng: 105.852 } as const;

/** Điểm trung tính: trên mốc này là điểm mạnh, từ mốc trở xuống là điểm yếu. */
export const NEUTRAL_SCORE = 5;
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;

type Measure =
  /** Khoảng cách tới điểm gần nhất: càng gần càng tốt. */
  | { kind: 'near'; good: number; bad: number; range: [number, number]; noun: string; source: string }
  /** Khoảng cách tới nguồn ồn: càng xa càng tốt. */
  | { kind: 'far'; good: number; bad: number; range: [number, number]; noun: string; source: string }
  | { kind: 'count'; perPoint: number; range: [number, number]; noun: string; source: string }
  | { kind: 'population'; range: [number, number]; source: string }
  | { kind: 'air'; range: [number, number]; source: string }
  | { kind: 'elevation'; range: [number, number]; source: string }
  | { kind: 'flood'; source: string }
  | { kind: 'green'; range: [number, number]; source: string }
  | { kind: 'inner'; good: number; bad: number; source: string };

export interface CriterionDefinition {
  id: string;
  label: string;
  group: CriterionGroup;
  measure: Measure;
}

const OSM = 'OpenStreetMap';

export const CRITERIA: readonly CriterionDefinition[] = [
  { id: 'cho', label: 'Chợ', group: 'walk', measure: { kind: 'near', good: 250, bad: 1200, range: [80, 1600], noun: 'chợ', source: OSM } },
  { id: 'hieu-thuoc', label: 'Hiệu thuốc', group: 'walk', measure: { kind: 'near', good: 150, bad: 800, range: [40, 1100], noun: 'hiệu thuốc', source: OSM } },
  { id: 'sieu-thi', label: 'Siêu thị', group: 'walk', measure: { kind: 'near', good: 300, bad: 1500, range: [120, 2200], noun: 'siêu thị', source: OSM } },
  { id: 'ubnd', label: 'UBND', group: 'walk', measure: { kind: 'near', good: 400, bad: 2000, range: [150, 2600], noun: 'UBND', source: OSM } },
  { id: 'vat-tu', label: 'Cửa hàng vật tư', group: 'walk', measure: { kind: 'near', good: 400, bad: 2000, range: [150, 3000], noun: 'cửa hàng vật tư', source: OSM } },
  { id: 'quan-an', label: 'Quán ăn, cà phê', group: 'walk', measure: { kind: 'count', perPoint: 3, range: [2, 45], noun: 'quán', source: OSM } },
  { id: 'cong-vien', label: 'Công viên', group: 'walk', measure: { kind: 'near', good: 300, bad: 1500, range: [100, 2400], noun: 'công viên', source: OSM } },
  { id: 'truong-hoc', label: 'Trường học', group: 'walk', measure: { kind: 'near', good: 300, bad: 1200, range: [80, 1800], noun: 'trường', source: OSM } },
  { id: 'duong-lon', label: 'Đường lớn', group: 'move', measure: { kind: 'near', good: 150, bad: 900, range: [20, 1300], noun: 'đường lớn', source: OSM } },
  { id: 'noi-do', label: 'Nội đô', group: 'move', measure: { kind: 'inner', good: 3000, bad: 20000, source: 'Mốc Hồ Gươm (cấu hình)' } },
  { id: 'metro', label: 'Ga metro', group: 'move', measure: { kind: 'near', good: 600, bad: 2000, range: [250, 4500], noun: 'ga metro', source: 'OSM, GTFS Hà Nội' } },
  { id: 'xe-buyt', label: 'Điểm xe buýt', group: 'move', measure: { kind: 'near', good: 150, bad: 500, range: [40, 900], noun: 'điểm dừng', source: 'GTFS Hà Nội, OSM' } },
  { id: 'on-giao-thong', label: 'Ồn giao thông', group: 'move', measure: { kind: 'far', good: 600, bad: 80, range: [30, 1500], noun: 'đường trục', source: OSM } },
  { id: 'benh-vien', label: 'Bệnh viện', group: 'health', measure: { kind: 'near', good: 800, bad: 2000, range: [300, 4500], noun: 'bệnh viện', source: OSM } },
  { id: 'mat-do-dan-cu', label: 'Mật độ dân cư', group: 'env', measure: { kind: 'population', range: [3000, 32000], source: 'WorldPop 100 m' } },
  { id: 'khong-khi', label: 'Không khí', group: 'env', measure: { kind: 'air', range: [18, 75], source: 'OpenAQ' } },
  { id: 'do-cao', label: 'Độ cao tương đối', group: 'env', measure: { kind: 'elevation', range: [-2.5, 2.5], source: 'FABDEM' } },
  { id: 'ngap-song', label: 'Ngập sông (mô hình)', group: 'env', measure: { kind: 'flood', source: 'JRC Global River Flood Hazard' } },
  { id: 'mang-xanh', label: 'Mảng xanh', group: 'env', measure: { kind: 'green', range: [3, 38], source: 'ESA WorldCover' } },
];

export const CRITERION_IDS: ReadonlySet<string> = new Set(CRITERIA.map((item) => item.id));

/** Kết quả đo tự động của một tiêu chí (chưa gộp chỉnh tay). */
export interface CriterionMeasurement {
  id: string;
  autoScore: number;
  verdict: string;
  detail: string;
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
}

export interface PlaceEvaluation {
  placeKey: string;
  lat: number;
  lng: number;
  /** true: số liệu minh họa, chưa phải kết quả đo thật. */
  sample: boolean;
  /** Điểm tổng 0–10 (trung bình các tiêu chí không bỏ qua); null nếu đã bỏ qua hết. */
  overall: number | null;
  rating: string;
  summary: string;
  strengths: { points: number; items: EvaluatedCriterion[] };
  weaknesses: { points: number; items: EvaluatedCriterion[] };
  skipped: EvaluatedCriterion[];
  criteriaCount: number;
}

/** Khóa địa điểm: tọa độ làm tròn 5 chữ số (~1 m). Dùng cho cache, chỉnh tay và địa điểm đã lưu. */
export function placeKeyOf(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampScore(value: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, value));
}

/** Điểm chỉnh tay hợp lệ: 0–10, bước 0,5. */
export function normalizeManualScore(value: number): number {
  return clampScore(Math.round(value * 2) / 2);
}

/** Nội suy tuyến tính: `good` → 10, `bad` → 0 (hai chiều đều được). */
function linear(value: number, good: number, bad: number): number {
  if (good === bad) return NEUTRAL_SCORE;
  return round1(clampScore(((value - bad) / (good - bad)) * SCORE_MAX));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatInt(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

function nearVerdict(score: number): string {
  return score >= 7 ? 'Gần' : score >= 4 ? 'Vừa' : 'Xa';
}

/** PRNG mulberry32 có hạt giống: cùng tọa độ cho cùng chuỗi số. */
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

/**
 * Mức đô thị 0–1 theo khoảng cách tới Hồ Gươm (0 m → 1, từ 18 km → 0). Số minh họa dùng nó để nội đô
 * có tiện ích dày, ngoại thành thưa, giống thực tế hơn là ngẫu nhiên đều.
 */
export function urbanFactor(point: { lat: number; lng: number }): number {
  return Math.max(0, 1 - haversineM(point, INNER_CITY_ANCHOR) / 18000);
}

function measure(definition: CriterionDefinition, random: () => number, point: { lat: number; lng: number }): CriterionMeasurement {
  const m = definition.measure;
  const urban = urbanFactor(point);
  /** Khoảng cách: nội đô kéo về đầu thấp của khoảng. */
  const pickNear = (range: [number, number]): number => range[0] + (range[1] - range[0]) * random() * (0.25 + 0.75 * (1 - urban));
  /** Số lượng/mật độ: nội đô kéo về đầu cao của khoảng. */
  const pickDense = (range: [number, number]): number => range[0] + (range[1] - range[0]) * Math.min(1, random() * 0.6 + urban * 0.5);
  const pick = (range: [number, number]): number => range[0] + (range[1] - range[0]) * random();
  switch (m.kind) {
    case 'near': {
      const distance = pickNear(m.range);
      const score = linear(distance, m.good, m.bad);
      return { id: definition.id, autoScore: score, verdict: nearVerdict(score), detail: `Cách ${m.noun} gần nhất ${formatDistance(distance)}` };
    }
    case 'far': {
      const distance = pick(m.range);
      const score = linear(distance, m.good, m.bad);
      return {
        id: definition.id,
        autoScore: score,
        verdict: score >= 7 ? 'Yên tĩnh' : score >= 4 ? 'Hơi ồn' : 'Ồn',
        detail: `Cách ${m.noun} ${formatDistance(distance)}`,
      };
    }
    case 'count': {
      const count = Math.round(pickDense(m.range));
      const score = round1(clampScore(count / m.perPoint));
      return {
        id: definition.id,
        autoScore: score,
        verdict: score >= 7 ? 'Nhiều' : score >= 4 ? 'Vừa' : 'Ít',
        detail: `${count} ${m.noun} trong 500 m`,
      };
    }
    case 'population': {
      const people = pickDense(m.range);
      // Đông vừa phải là tốt nhất: quá thưa thì thiếu dịch vụ, quá đông thì chật.
      const score = round1(clampScore(SCORE_MAX - Math.abs(people - 15000) / 1800));
      return {
        id: definition.id,
        autoScore: score,
        verdict: people > 22000 ? 'Rất đông' : people > 9000 ? 'Đông vừa' : 'Thưa',
        detail: `Khoảng ${formatInt(Math.round(people / 100) * 100)} người trong 500 m`,
      };
    }
    case 'air': {
      const pm = pick(m.range);
      const station = 0.6 + random() * 2.3;
      const score = linear(pm, 15, 75);
      return {
        id: definition.id,
        autoScore: score,
        verdict: pm <= 30 ? 'Tốt' : pm <= 50 ? 'Trung bình' : 'Kém',
        detail: `PM2.5 ${Math.round(pm)} µg/m³, trạm cách ${station.toFixed(1).replace('.', ',')} km`,
      };
    }
    case 'elevation': {
      const delta = pick(m.range);
      const score = linear(delta, 2, -2);
      const abs = Math.abs(delta).toFixed(1).replace('.', ',');
      return {
        id: definition.id,
        autoScore: score,
        verdict: delta >= 0.5 ? 'Cao hơn xung quanh' : delta <= -0.5 ? 'Thấp hơn xung quanh' : 'Ngang xung quanh',
        detail: delta >= 0 ? `Cao hơn trung vị 500 m khoảng ${abs} m` : `Thấp hơn trung vị 500 m khoảng ${abs} m`,
      };
    }
    case 'flood': {
      const inZone = random() < 0.3;
      const depth = inZone ? 0.1 + random() * 1.2 : 0;
      const score = inZone ? linear(depth, 0, 1.5) : 9;
      return {
        id: definition.id,
        autoScore: score,
        verdict: inZone ? 'Trong vệt ngập mô hình' : 'Ngoài vệt ngập mô hình',
        detail: inZone ? `Độ sâu mô hình ${depth.toFixed(1).replace('.', ',')} m ở chu kỳ 100 năm` : 'Không nằm trong vệt ngập sông chu kỳ 100 năm',
      };
    }
    case 'green': {
      const ratio = pick(m.range);
      const score = linear(ratio, 30, 5);
      return {
        id: definition.id,
        autoScore: score,
        verdict: ratio >= 22 ? 'Nhiều cây' : ratio >= 12 ? 'Vừa' : 'Ít cây',
        detail: `${Math.round(ratio)}% diện tích có thực vật trong 300 m`,
      };
    }
    case 'inner': {
      const distance = haversineM(point, INNER_CITY_ANCHOR);
      const score = linear(distance, m.good, m.bad);
      return { id: definition.id, autoScore: score, verdict: nearVerdict(score), detail: `Cách Hồ Gươm ${formatDistance(distance)}` };
    }
  }
}

/** Đo tự động mọi tiêu chí tại một điểm (hiện là số minh họa ổn định theo tọa độ). */
export function generateCriteria(lat: number, lng: number): CriterionMeasurement[] {
  const random = seeded(placeKeyOf(lat, lng));
  return CRITERIA.map((definition) => measure(definition, random, { lat, lng }));
}

function ratingOf(overall: number | null): string {
  if (overall === null) return 'Chưa đủ tiêu chí';
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

function summarize(overall: number | null, rating: string, strengths: EvaluatedCriterion[], weaknesses: EvaluatedCriterion[], used: number): string {
  if (overall === null) return 'Mọi tiêu chí đều đã bị bỏ qua nên chưa có nhận xét. Khôi phục ít nhất một tiêu chí để xem điểm.';
  const top = strengths.slice(0, 3);
  const low = [...weaknesses].sort((a, b) => a.score - b.score).slice(0, 3);
  const parts = [`Điểm ${overall.toFixed(1).replace('.', ',')}/10, mức ${rating.toLowerCase()} trên ${used} tiêu chí.`];
  if (top.length > 0) parts.push(`Nổi bật ở ${joinLabels(top)}.`);
  if (low.length > 0) parts.push(`Cần cân nhắc ${joinLabels(low)}.`);
  return parts.join(' ');
}

/** Gộp số đo tự động với chỉnh tay của người dùng, chia điểm mạnh/yếu và tính điểm tổng. */
export function buildEvaluation(
  lat: number,
  lng: number,
  measurements: CriterionMeasurement[],
  overrides: CriterionOverride[],
  sample = true,
): PlaceEvaluation {
  const byId = new Map(overrides.map((item) => [item.criterionId, item]));
  const evaluated: EvaluatedCriterion[] = [];
  for (const definition of CRITERIA) {
    const measured = measurements.find((item) => item.id === definition.id);
    if (!measured) continue;
    const override = byId.get(definition.id);
    const manual = override?.score !== null && override?.score !== undefined;
    evaluated.push({
      id: definition.id,
      label: definition.label,
      group: definition.group,
      groupLabel: CRITERION_GROUPS[definition.group],
      verdict: measured.verdict,
      detail: measured.detail,
      source: definition.measure.source,
      score: manual ? normalizeManualScore(override.score as number) : measured.autoScore,
      autoScore: measured.autoScore,
      manual,
      skipped: override?.skipped === true,
    });
  }
  const active = evaluated.filter((item) => !item.skipped);
  const strengths = active.filter((item) => item.score > NEUTRAL_SCORE).sort((a, b) => b.score - a.score);
  const weaknesses = active.filter((item) => item.score <= NEUTRAL_SCORE).sort((a, b) => a.score - b.score);
  const overall = active.length > 0 ? round1(active.reduce((sum, item) => sum + item.score, 0) / active.length) : null;
  const rating = ratingOf(overall);
  return {
    placeKey: placeKeyOf(lat, lng),
    lat,
    lng,
    sample,
    overall,
    rating,
    summary: summarize(overall, rating, strengths, weaknesses, active.length),
    strengths: { points: round1(strengths.reduce((sum, item) => sum + (item.score - NEUTRAL_SCORE), 0)), items: strengths },
    weaknesses: { points: round1(weaknesses.reduce((sum, item) => sum + (NEUTRAL_SCORE - item.score), 0)), items: weaknesses },
    skipped: evaluated.filter((item) => item.skipped),
    criteriaCount: evaluated.length,
  };
}
