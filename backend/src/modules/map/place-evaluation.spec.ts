import { describe, expect, it } from 'vitest';
import { placeKindOf } from './map.mapper.js';
import {
  CRITERIA,
  DEFAULT_WEIGHTS,
  NEUTRAL_SCORE,
  buildEvaluation,
  formatDistance,
  isValidWeight,
  mockPendingMeasurement,
  normalizeManualScore,
  placeKeyOf,
  type CriterionMeasurement,
} from './place-evaluation.js';

const lat = 21.0368;
const lng = 105.8342;

/** Số đo giả: mọi tiêu chí đo thật đều `ok`, độ tin `medium`, điểm khác nhau; tiêu chí AI là số minh họa. */
function measured(overrides: Partial<Record<string, Partial<CriterionMeasurement>>> = {}): CriterionMeasurement[] {
  return CRITERIA.map((definition, index) => {
    const base: CriterionMeasurement =
      definition.status === 'not_implemented'
        ? mockPendingMeasurement(definition, lat, lng)
        : { id: definition.id, autoScore: (index * 7) % 11, verdict: 'Đo', detail: 'Số đo', status: 'ok', confidence: 'medium' };
    return { ...base, ...overrides[definition.id] };
  });
}

const live = CRITERIA.filter((item) => item.status === 'live');
const pendingAi = CRITERIA.filter((item) => item.status === 'not_implemented');

describe('place-evaluation', () => {
  it('tiêu chí cần AI: số minh họa cụ thể, ổn định theo tọa độ, gắn chưa thực hiện', () => {
    expect(pendingAi.map((item) => item.id)).toEqual(['ngap-ung', 'quy-hoach', 'an-ninh']);
    for (const definition of pendingAi) {
      const first = mockPendingMeasurement(definition, lat, lng);
      expect(first.status).toBe('not_implemented');
      expect(first.detail).toMatch(/số minh họa/);
      expect(first.note).toMatch(/chưa được thực hiện/);
      expect(first.autoScore).toBeGreaterThanOrEqual(0);
      expect(first.autoScore).toBeLessThanOrEqual(10);
      expect(mockPendingMeasurement(definition, lat, lng)).toEqual(first);
    }
  });

  it('điểm tổng chỉ gồm tiêu chí đo thật và đủ tin; số minh họa nằm ở "chưa tính"', () => {
    const evaluation = buildEvaluation(lat, lng, measured(), []);
    const placed = [...evaluation.strengths.items, ...evaluation.weaknesses.items];
    expect(placed).toHaveLength(live.length);
    expect(evaluation.pending.map((item) => item.id)).toEqual(pendingAi.map((item) => item.id));
    expect(evaluation.pending.every((item) => !item.counted && item.status === 'not_implemented')).toBe(true);
    expect(evaluation.strengths.items.every((item) => item.score > NEUTRAL_SCORE)).toBe(true);
    expect(evaluation.weaknesses.items.every((item) => item.score <= NEUTRAL_SCORE)).toBe(true);
    const total = placed.reduce((sum, item) => sum + DEFAULT_WEIGHTS[item.id], 0);
    const mean = placed.reduce((sum, item) => sum + item.score * DEFAULT_WEIGHTS[item.id], 0) / total;
    expect(evaluation.overall).toBeCloseTo(Math.round(mean * 10) / 10, 5);
    expect(evaluation.coverage).toBe(1);
    expect(evaluation.criteriaCount).toBe(CRITERIA.length);
    expect(evaluation.sample).toBe(false);
  });

  it('không đo được hoặc độ tin thấp thì không tính; chấm tay thì tính; độ phủ giảm', () => {
    const evaluation = buildEvaluation(
      lat,
      lng,
      measured({
        cho: { status: 'no_data', autoScore: NEUTRAL_SCORE, confidence: 'low' },
        'vat-tu': { status: 'ok', confidence: 'low' },
        'khong-khi': { status: 'unavailable', autoScore: NEUTRAL_SCORE, confidence: 'low' },
      }),
      [{ criterionId: 'khong-khi', skipped: false, score: 3 }],
    );
    const pendingIds = evaluation.pending.map((item) => item.id);
    expect(pendingIds).toContain('cho');
    expect(pendingIds).toContain('vat-tu');
    expect(pendingIds).not.toContain('khong-khi');
    const air = evaluation.weaknesses.items.find((item) => item.id === 'khong-khi');
    expect(air?.counted).toBe(true);
    expect(air?.manual).toBe(true);
    expect(evaluation.coverage).toBeLessThan(1);
    expect(evaluation.coverage).toBeGreaterThan(0.8);
  });

  it('dữ liệu mỏng (độ phủ dưới 60%) thì ghi chú trong nhận xét', () => {
    const missing = Object.fromEntries(live.slice(0, 15).map((item) => [item.id, { status: 'no_data' as const, confidence: 'low' as const }]));
    const evaluation = buildEvaluation(lat, lng, measured(missing), []);
    expect(evaluation.coverage).toBeLessThan(0.6);
    expect(evaluation.summary).toMatch(/Dữ liệu còn mỏng/);
  });

  it('điều kiện chặn: ngập sâu giới hạn điểm tổng và đứng đầu nhận xét', () => {
    const high = Object.fromEntries(live.map((item) => [item.id, { autoScore: 10 }]));
    const evaluation = buildEvaluation(lat, lng, measured({ ...high, 'ngap-song': { autoScore: 0, blockingHit: true } }), []);
    expect(evaluation.blocking.map((item) => item.criterionId)).toEqual(['ngap-song']);
    expect(evaluation.overall).toBe(4);
    expect(evaluation.summary.startsWith('Nằm trong vệt ngập')).toBe(true);
    // Người dùng tự chấm tay thì bỏ điều kiện chặn của tiêu chí đó.
    const manual = buildEvaluation(lat, lng, measured({ ...high, 'ngap-song': { autoScore: 0, blockingHit: true } }), [
      { criterionId: 'ngap-song', skipped: false, score: 8 },
    ]);
    expect(manual.blocking).toEqual([]);
  });

  it('bỏ qua tiêu chí và đặt điểm tay', () => {
    const evaluation = buildEvaluation(lat, lng, measured(), [
      { criterionId: 'cho', skipped: true, score: null },
      { criterionId: 'benh-vien', skipped: false, score: 9.3 },
    ]);
    expect(evaluation.skipped.map((item) => item.id)).toEqual(['cho']);
    const hospital = evaluation.strengths.items.find((item) => item.id === 'benh-vien');
    expect(hospital?.manual).toBe(true);
    expect(hospital?.score).toBe(9.5);
    const market = [...evaluation.strengths.items, ...evaluation.weaknesses.items].find((item) => item.id === 'cho');
    expect(market?.skipped).toBe(true);
    expect(market?.counted).toBe(false);
  });

  it('trọng số của người dùng: bằng nhau thì là trung bình thường; 0 không tính; hết trọng số thì không có điểm', () => {
    const items = measured();
    const equal = new Map(CRITERIA.map((item) => [item.id, 1]));
    const flat = buildEvaluation(lat, lng, items, [], false, equal);
    const scores = items.filter((item) => item.status === 'ok').map((item) => item.autoScore);
    expect(flat.overall).toBeCloseTo(Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10, 5);

    const onlyHospital = new Map(CRITERIA.map((item) => [item.id, item.id === 'benh-vien' ? 5 : 0]));
    const hospital = items.find((item) => item.id === 'benh-vien');
    expect(buildEvaluation(lat, lng, items, [], false, onlyHospital).overall).toBe(hospital?.autoScore);

    const none = new Map(CRITERIA.map((item) => [item.id, 0]));
    expect(buildEvaluation(lat, lng, items, [], false, none).overall).toBeNull();
  });

  it('bản phân tích cũ (không có trạng thái) vẫn đọc được như đo thật', () => {
    const legacy: CriterionMeasurement[] = live.map((item) => ({ id: item.id, autoScore: 6, verdict: 'Vừa', detail: 'cũ' }));
    const evaluation = buildEvaluation(lat, lng, legacy, [], true);
    expect(evaluation.overall).toBe(6);
    expect(evaluation.pending).toEqual([]);
    expect(evaluation.criteriaCount).toBe(live.length);
  });

  it('mỗi tiêu chí có trọng số mặc định hợp lệ, mã không trùng', () => {
    for (const item of CRITERIA) expect(isValidWeight(DEFAULT_WEIGHTS[item.id])).toBe(true);
    expect(new Set(CRITERIA.map((item) => item.id)).size).toBe(CRITERIA.length);
    expect(isValidWeight(6)).toBe(false);
    expect(isValidWeight(2.5)).toBe(false);
  });

  it('bỏ qua hết thì không có điểm tổng', () => {
    const evaluation = buildEvaluation(lat, lng, measured(), CRITERIA.map((item) => ({ criterionId: item.id, skipped: true, score: null })));
    expect(evaluation.overall).toBeNull();
    expect(evaluation.strengths.points).toBe(0);
    expect(evaluation.weaknesses.points).toBe(0);
  });

  it('tiện ích nhỏ', () => {
    expect(normalizeManualScore(7.26)).toBe(7.5);
    expect(normalizeManualScore(12)).toBe(10);
    expect(formatDistance(1450)).toBe('1,4 km');
    expect(formatDistance(234)).toBe('230 m');
    expect(placeKeyOf(21.0368123, 105.8342987)).toBe('21.03681,105.83430');
    expect(placeKindOf('vm:POI:abc')).toBe('poi');
    expect(placeKindOf('geocode:xyz')).toBe('unknown');
  });
});
