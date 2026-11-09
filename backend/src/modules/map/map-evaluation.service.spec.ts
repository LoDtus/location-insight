import { describe, expect, it } from 'vitest';
import { FindOperator } from 'typeorm';
import type { RedisService } from '../../integrations/redis/redis.service.js';
import type { MapDatasetService } from './map-dataset.service.js';
import { MapEvaluationService } from './map-evaluation.service.js';
import type { MapLimitsService } from './map-limits.service.js';
import type { MapWeightsService } from './map-weights.service.js';
import type { MapPlaceResolver, ResolvedPlace } from './map-place-resolver.service.js';
import type { PlaceMeasureService } from './measure/place-measure.service.js';
import { CRITERIA, mockPendingMeasurement, type CriterionMeasurement } from './place-evaluation.js';
import { pickPlace } from './place-identity.js';

/**
 * Đặc tả: workspace/features/013-map/README.md §4c (lượt đánh giá, bản phân tích mới nhất của địa điểm,
 * "Đánh giá lại" luôn gọi AI) và §4d (nhận diện địa điểm). Repository giả trong bộ nhớ.
 */
type Row = { [key: string]: unknown };

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected instanceof FindOperator) return (expected.value as unknown[]).includes(row[key]);
    return row[key] === expected;
  });
}

let seq = 0;
let clock = Date.parse('2026-11-05T00:00:00Z');

function byNewest(a: Row, b: Row): number {
  return (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime();
}

function fakeRepo() {
  const rows: Row[] = [];
  const repo = {
    rows,
    create: (value: Row) => ({ ...value }),
    async save(value: Row): Promise<Row> {
      const saved = { id: `id-${++seq}`, createdAt: new Date((clock += 1000)), ...value };
      rows.push(saved);
      return saved;
    },
    async findOne({ where, order }: { where: Row; order?: Row }): Promise<Row | null> {
      const found = rows.filter((row) => matches(row, where));
      if (order?.createdAt === 'DESC') found.sort(byNewest);
      return found[0] ?? null;
    },
    async find({ where, order }: { where: Row; order?: Row }): Promise<Row[]> {
      const found = rows.filter((row) => matches(row, where));
      if (order?.createdAt === 'DESC') found.sort(byNewest);
      return found;
    },
    async delete(where: Row): Promise<void> {
      for (let i = rows.length - 1; i >= 0; i -= 1) if (matches(rows[i], where)) rows.splice(i, 1);
    },
    async upsert(value: Row, keys: string[]): Promise<void> {
      const index = rows.findIndex((row) => keys.every((key) => row[key] === value[key]));
      if (index >= 0) rows[index] = { ...rows[index], ...value };
      else rows.push({ ...value });
    },
    manager: {
      transaction: async <T>(work: (manager: { query: () => Promise<void>; getRepository: () => unknown }) => Promise<T>) =>
        work({ query: async () => undefined, getRepository: () => repo }),
    },
  };
  return repo;
}

/** Bộ nhận diện giả: dùng đúng quy tắc pickPlace (không có địa chỉ Reverse). */
function fakeResolver() {
  const places: ResolvedPlace[] = [];
  const find = async (lat: number, lng: number): Promise<ResolvedPlace | null> => {
    const match = pickPlace({ lat, lng }, null, places.map((item) => ({ ...item, addressKey: null })));
    return match ? (places.find((item) => item.id === match.id) ?? null) : null;
  };
  return {
    places,
    find,
    async resolve(lat: number, lng: number): Promise<ResolvedPlace> {
      const found = await find(lat, lng);
      if (found) return found;
      const created = { id: `place-${++seq}`, lat, lng, name: '', address: '' };
      places.push(created);
      return created;
    },
  };
}

/** Bộ đo giả: tiêu chí đo thật trả điểm cố định theo thứ tự, tiêu chí AI trả số minh họa như bản thật. */
function fakeMeasurer() {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async measure(lat: number, lng: number): Promise<CriterionMeasurement[]> {
      calls += 1;
      return CRITERIA.map((definition, index) =>
        definition.status === 'not_implemented'
          ? mockPendingMeasurement(definition, lat, lng)
          : { id: definition.id, autoScore: (index * 3) % 11, verdict: 'Đo', detail: 'Số đo', status: 'ok', confidence: 'medium' },
      );
    },
  };
}

function setup() {
  const analyses = fakeRepo();
  const runs = fakeRepo();
  const overrides = fakeRepo();
  let version = 1;
  const weights = new Map<string, number>();
  const measurer = fakeMeasurer();
  const service = new MapEvaluationService(
    analyses as never,
    runs as never,
    overrides as never,
    fakeResolver() as unknown as MapPlaceResolver,
    { current: async () => version } as unknown as MapDatasetService,
    { consumeUser: async () => undefined } as unknown as MapLimitsService,
    { get: async () => undefined, set: async () => undefined } as unknown as RedisService,
    { mapFor: async () => weights } as unknown as MapWeightsService,
    measurer as unknown as PlaceMeasureService,
  );
  return { service, analyses, runs, weights, measurer, release: () => (version += 1) };
}

const A = 'user-a';
const B = 'user-b';
const C = 'user-c';
const lat = 21.0368;
const lng = 105.8342;
/** Cùng địa điểm, lệch ~2 m về phía bắc. */
const nearLat = lat + 2 / 111_320;

describe('MapEvaluationService', () => {
  it('chưa bấm thì GET trả null và không gọi AI', async () => {
    const { service, analyses } = setup();
    expect((await service.mine(A, lat, lng)).evaluation).toBeNull();
    expect(analyses.rows).toHaveLength(0);
  });

  it('địa điểm chưa ai đánh giá: "Đánh giá" gọi AI (fresh)', async () => {
    const { service, analyses } = setup();
    const result = await service.run(A, lat, lng, false);
    expect(result.source).toBe('fresh');
    expect(analyses.rows).toHaveLength(1);
  });

  it('người sau bấm "Đánh giá" nhận bản phân tích mới nhất, không gọi AI; người chưa bấm vẫn không thấy', async () => {
    const { service, analyses, runs } = setup();
    await service.run(A, lat, lng, false);
    expect((await service.mine(B, lat, lng)).evaluation).toBeNull();
    const second = await service.run(B, lat, lng, false);
    expect(second.source).toBe('shared');
    expect(analyses.rows).toHaveLength(1);
    expect(runs.rows.map((row) => row.userId)).toEqual([A, B]);
  });

  it('"Đánh giá lại" luôn gọi AI và thành bản mới nhất cho người bấm "Đánh giá" sau đó', async () => {
    const { service, analyses } = setup();
    await service.run(A, lat, lng, false);
    const again = await service.run(A, lat, lng, true);
    const againTwice = await service.run(A, lat, lng, true);
    expect(again.source).toBe('fresh');
    expect(againTwice.source).toBe('fresh');
    expect(analyses.rows).toHaveLength(3);
    const later = await service.run(C, lat, lng, false);
    expect(later.source).toBe('shared');
    expect(later.evaluation.analyzedAt).toBe(againTwice.evaluation.analyzedAt);
  });

  it('bấm lệch vài mét vẫn là cùng địa điểm (không gọi AI lại)', async () => {
    const { service, analyses } = setup();
    await service.run(A, lat, lng, false);
    const nearby = await service.run(B, nearLat, lng, false);
    expect(nearby.source).toBe('shared');
    expect(analyses.rows).toHaveLength(1);
    expect((await service.mine(A, nearLat, lng)).evaluation?.placeId).toBe(nearby.evaluation.placeId);
  });

  it('mở lại thấy đúng lượt gần nhất của mình; admin nâng phiên bản không tự đánh giá lại', async () => {
    const { service, runs, release } = setup();
    await service.run(A, lat, lng, false);
    release();
    const opened = await service.mine(A, lat, lng);
    expect(opened.evaluation?.datasetVersion).toBe(1);
    expect(opened.evaluation?.outdated).toBe(true);
    expect(runs.rows).toHaveLength(1);
    const rerun = await service.run(A, lat, lng, true);
    expect(rerun.evaluation.datasetVersion).toBe(2);
    expect(rerun.evaluation.outdated).toBe(false);
  });

  it('chỉnh tiêu chí khi chưa có lượt của chính mình thì 404, kể cả khi người khác đã đánh giá', async () => {
    const { service } = setup();
    await service.run(A, lat, lng, false);
    await expect(service.override(B, 'cho', { lat, lng, skipped: true })).rejects.toMatchObject({ status: 404 });
    const own = await service.override(A, 'cho', { lat, lng, skipped: true });
    expect(own.skipped.map((item) => item.id)).toEqual(['cho']);
  });

  it('điểm tổng theo trọng số của chính người dùng; đổi trọng số không gọi AI', async () => {
    const { service, analyses, weights } = setup();
    const first = await service.run(A, lat, lng, false);
    const hospital = [...first.evaluation.strengths.items, ...first.evaluation.weaknesses.items].find((item) => item.id === 'benh-vien');
    for (const definition of CRITERIA) if (definition.id !== 'benh-vien') weights.set(definition.id, 0);
    const reopened = await service.mine(A, lat, lng);
    expect(reopened.evaluation?.overall).toBe(hospital?.score);
    expect(analyses.rows).toHaveLength(1);
  });

  it('tóm tắt cho danh sách đã lưu chỉ gồm lượt của chính người dùng', async () => {
    const { service } = setup();
    const result = await service.run(A, lat, lng, false);
    const placeId = result.evaluation.placeId;
    expect((await service.summaries(A, [placeId])).get(placeId)?.datasetVersion).toBe(1);
    expect((await service.summaries(B, [placeId])).size).toBe(0);
  });
});
