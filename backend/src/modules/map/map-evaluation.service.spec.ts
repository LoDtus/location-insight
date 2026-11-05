import { describe, expect, it } from 'vitest';
import { FindOperator } from 'typeorm';
import type { MapCriterionOverrideEntity } from './entities/map-criterion-override.entity.js';
import type { MapPlaceAnalysisEntity } from './entities/map-place-analysis.entity.js';
import type { MapPlaceEvaluationRunEntity } from './entities/map-place-evaluation-run.entity.js';
import type { MapDatasetService } from './map-dataset.service.js';
import { MapEvaluationService } from './map-evaluation.service.js';
import type { MapLimitsService } from './map-limits.service.js';
import type { RedisService } from '../../integrations/redis/redis.service.js';

/**
 * Đặc tả: workspace/features/013-map/README.md §4c (lượt đánh giá theo người dùng + phiên bản dữ liệu).
 * Repository giả trong bộ nhớ, đủ cho các truy vấn service dùng.
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

function fakeRepo<T extends Row>() {
  const rows: T[] = [];
  return {
    rows,
    create: (value: Partial<T>) => ({ ...value }) as T,
    async save(value: T): Promise<T> {
      const saved = { id: `id-${++seq}`, createdAt: new Date((clock += 1000)), ...value } as T;
      rows.push(saved);
      return saved;
    },
    async findOne({ where, order }: { where: Row; order?: Row }): Promise<T | null> {
      const found = rows.filter((row) => matches(row, where));
      if (order?.createdAt === 'DESC') found.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
      return found[0] ?? null;
    },
    async find({ where, order }: { where: Row; order?: Row }): Promise<T[]> {
      const found = rows.filter((row) => matches(row, where));
      if (order?.createdAt === 'DESC') found.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
      return found;
    },
    async delete(where: Row): Promise<void> {
      for (let i = rows.length - 1; i >= 0; i -= 1) if (matches(rows[i] as Row, where)) rows.splice(i, 1);
    },
    async upsert(value: T, keys: string[]): Promise<void> {
      const index = rows.findIndex((row) => keys.every((key) => row[key] === value[key]));
      if (index >= 0) rows[index] = { ...rows[index], ...value };
      else rows.push({ ...value });
    },
    createQueryBuilder() {
      let pending: T | null = null;
      const builder = {
        insert: () => builder,
        values: (value: T) => {
          pending = value;
          return builder;
        },
        orIgnore: () => builder,
        execute: async () => {
          const value = pending as T;
          const exists = rows.some((row) => row.placeKey === value.placeKey && row.datasetVersion === value.datasetVersion);
          if (!exists) rows.push({ id: `analysis-${++seq}`, createdAt: new Date(), ...value });
        },
      };
      return builder;
    },
  };
}

function setup() {
  const analyses = fakeRepo<MapPlaceAnalysisEntity & Row>();
  const runs = fakeRepo<MapPlaceEvaluationRunEntity & Row>();
  const overrides = fakeRepo<MapCriterionOverrideEntity & Row>();
  let version = 1;
  const dataset = { current: async () => version } as unknown as MapDatasetService;
  const limits = { consumeUser: async () => undefined } as unknown as MapLimitsService;
  const redis = { get: async () => undefined, set: async () => undefined } as unknown as RedisService;
  const service = new MapEvaluationService(
    analyses as never,
    runs as never,
    overrides as never,
    dataset,
    limits,
    redis,
  );
  return { service, analyses, runs, overrides, release: () => (version += 1) };
}

const A = 'user-a';
const B = 'user-b';
const lat = 21.0368;
const lng = 105.8342;

describe('MapEvaluationService', () => {
  it('chưa bấm đánh giá thì GET trả null, không tạo bản phân tích', async () => {
    const { service, analyses } = setup();
    const result = await service.mine(A, lat, lng);
    expect(result.evaluation).toBeNull();
    expect(analyses.rows).toHaveLength(0);
  });

  it('người khác không thấy đánh giá của người trước; phải tự bấm (tạo lượt riêng, dùng lại bản phân tích)', async () => {
    const { service, analyses, runs } = setup();
    const first = await service.run(A, lat, lng);
    expect(first.charged).toBe(true);
    expect((await service.mine(B, lat, lng)).evaluation).toBeNull();

    const second = await service.run(B, lat, lng);
    expect(second.charged).toBe(true);
    expect(runs.rows.map((row) => row.userId)).toEqual([A, B]);
    expect(analyses.rows).toHaveLength(1);
    expect(second.evaluation.overall).toBe(first.evaluation.overall);
  });

  it('mở lại địa điểm thấy đúng lượt đã bấm, không tạo lượt mới', async () => {
    const { service, runs } = setup();
    await service.run(A, lat, lng);
    const again = await service.mine(A, lat, lng);
    expect(again.evaluation?.datasetVersion).toBe(1);
    expect(runs.rows).toHaveLength(1);
  });

  it('bấm lại khi vẫn cùng phiên bản dữ liệu: trả lượt cũ, không tính phí', async () => {
    const { service, runs } = setup();
    await service.run(A, lat, lng);
    const again = await service.run(A, lat, lng);
    expect(again.charged).toBe(false);
    expect(runs.rows).toHaveLength(1);
  });

  it('admin nâng phiên bản: lượt cũ giữ nguyên (outdated), không tự đánh giá lại; bấm lại mới tạo lượt phiên bản mới', async () => {
    const { service, runs, analyses, release } = setup();
    await service.run(A, lat, lng);
    release();
    const opened = await service.mine(A, lat, lng);
    expect(opened.evaluation?.datasetVersion).toBe(1);
    expect(opened.evaluation?.outdated).toBe(true);
    expect(opened.currentDatasetVersion).toBe(2);
    expect(runs.rows).toHaveLength(1);

    const rerun = await service.run(A, lat, lng);
    expect(rerun.charged).toBe(true);
    expect(rerun.evaluation.datasetVersion).toBe(2);
    expect(rerun.evaluation.outdated).toBe(false);
    expect(analyses.rows.map((row) => row.datasetVersion)).toEqual([1, 2]);
  });

  it('chỉnh tiêu chí khi chưa có lượt của chính mình thì 404, kể cả khi người khác đã đánh giá', async () => {
    const { service } = setup();
    await service.run(A, lat, lng);
    await expect(service.override(B, 'cho', { lat, lng, skipped: true })).rejects.toMatchObject({ status: 404 });
    const own = await service.override(A, 'cho', { lat, lng, skipped: true });
    expect(own.skipped.map((item) => item.id)).toEqual(['cho']);
  });

  it('tóm tắt cho danh sách đã lưu chỉ gồm lượt của chính người dùng', async () => {
    const { service } = setup();
    await service.run(A, lat, lng);
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    expect((await service.summaries(A, [key])).get(key)?.datasetVersion).toBe(1);
    expect((await service.summaries(B, [key])).size).toBe(0);
  });
});
