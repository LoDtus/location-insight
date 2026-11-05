import { describe, expect, it } from 'vitest';
import {
  CRITERIA,
  NEUTRAL_SCORE,
  buildEvaluation,
  formatDistance,
  generateCriteria,
  normalizeManualScore,
  placeKeyOf,
} from './place-evaluation.js';
import { placeKindOf } from './map.mapper.js';

describe('place-evaluation', () => {
  const lat = 21.0368;
  const lng = 105.8342;

  it('sinh đủ tiêu chí và ổn định theo tọa độ', () => {
    const first = generateCriteria(lat, lng);
    expect(first).toHaveLength(CRITERIA.length);
    expect(generateCriteria(lat, lng)).toEqual(first);
    expect(generateCriteria(lat + 0.01, lng)).not.toEqual(first);
    for (const item of first) {
      expect(item.autoScore).toBeGreaterThanOrEqual(0);
      expect(item.autoScore).toBeLessThanOrEqual(10);
    }
  });

  it('Nội đô là khoảng cách thật tới Hồ Gươm', () => {
    const inner = generateCriteria(21.0285, 105.852).find((item) => item.id === 'noi-do');
    expect(inner?.autoScore).toBe(10);
    expect(inner?.detail).toBe('Cách Hồ Gươm 0 m');
  });

  it('chia điểm mạnh/yếu theo mốc trung tính và tính điểm tổng là trung bình', () => {
    const evaluation = buildEvaluation(lat, lng, generateCriteria(lat, lng), []);
    const all = [...evaluation.strengths.items, ...evaluation.weaknesses.items];
    expect(all).toHaveLength(CRITERIA.length);
    expect(evaluation.strengths.items.every((item) => item.score > NEUTRAL_SCORE)).toBe(true);
    expect(evaluation.weaknesses.items.every((item) => item.score <= NEUTRAL_SCORE)).toBe(true);
    const mean = all.reduce((sum, item) => sum + item.score, 0) / all.length;
    expect(evaluation.overall).toBeCloseTo(Math.round(mean * 10) / 10, 5);
    expect(evaluation.sample).toBe(true);
    expect(evaluation.summary.length).toBeGreaterThan(10);
  });

  it('bỏ qua tiêu chí và đặt điểm tay', () => {
    const measured = generateCriteria(lat, lng);
    const evaluation = buildEvaluation(lat, lng, measured, [
      { criterionId: 'cho', skipped: true, score: null },
      { criterionId: 'benh-vien', skipped: false, score: 9.3 },
    ]);
    expect(evaluation.skipped.map((item) => item.id)).toEqual(['cho']);
    const hospital = evaluation.strengths.items.find((item) => item.id === 'benh-vien');
    expect(hospital?.manual).toBe(true);
    expect(hospital?.score).toBe(9.5);
    // Tiêu chí bỏ qua vẫn ở trong nhóm của nó, có cờ skipped, nhưng không cộng vào điểm nhóm.
    const market = [...evaluation.strengths.items, ...evaluation.weaknesses.items].find((item) => item.id === 'cho');
    expect(market?.skipped).toBe(true);
    const group = evaluation.strengths.items.includes(market as never) ? evaluation.strengths : evaluation.weaknesses;
    const expected = group.items
      .filter((item) => !item.skipped)
      .reduce((sum, item) => sum + Math.abs(item.score - NEUTRAL_SCORE), 0);
    expect(group.points).toBeCloseTo(Math.round(expected * 10) / 10, 5);
  });

  it('bỏ qua hết thì không có điểm tổng', () => {
    const evaluation = buildEvaluation(
      lat,
      lng,
      generateCriteria(lat, lng),
      CRITERIA.map((item) => ({ criterionId: item.id, skipped: true, score: null })),
    );
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
