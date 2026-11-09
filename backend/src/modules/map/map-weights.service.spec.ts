import { describe, expect, it } from 'vitest';
import type { MapLimitsService } from './map-limits.service.js';
import { MapWeightsService } from './map-weights.service.js';
import { CRITERIA, DEFAULT_WEIGHTS } from './place-evaluation.js';

/** Đặc tả: workspace/features/013-map/README.md §4h (trọng số tiêu chí). Repository giả trong bộ nhớ. */
type Row = { userId: string; criterionId: string; weight: number };

function setup() {
  const rows: Row[] = [];
  const repo = {
    rows,
    async find({ where }: { where: { userId: string } }) {
      return rows.filter((row) => row.userId === where.userId);
    },
    async upsert(value: Row) {
      const index = rows.findIndex((row) => row.userId === value.userId && row.criterionId === value.criterionId);
      if (index >= 0) rows[index] = value;
      else rows.push(value);
    },
    async delete(where: Partial<Row>) {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (row.userId === where.userId && (where.criterionId === undefined || row.criterionId === where.criterionId)) rows.splice(index, 1);
      }
    },
  };
  const service = new MapWeightsService(repo as never, { consumeUser: async () => undefined } as unknown as MapLimitsService);
  return { service, rows };
}

describe('MapWeightsService', () => {
  it('mặc định: đủ mọi tiêu chí (cả tiêu chí AI chưa làm), không có thay đổi', async () => {
    const { service } = setup();
    const view = await service.list('a');
    expect(view.criteria).toHaveLength(CRITERIA.length);
    expect(view.changed).toBe(0);
    expect(view.criteria.every((item) => item.weight === DEFAULT_WEIGHTS[item.id])).toBe(true);
  });

  it('đổi trọng số chỉ ảnh hưởng người đó; đặt về đúng mặc định thì xóa hàng', async () => {
    const { service, rows } = setup();
    const changed = await service.set('a', 'cho', 5);
    expect(changed.changed).toBe(1);
    expect(changed.criteria.find((item) => item.id === 'cho')).toMatchObject({ weight: 5, custom: true });
    expect((await service.list('b')).changed).toBe(0);
    await service.set('a', 'cho', DEFAULT_WEIGHTS.cho);
    expect(rows).toHaveLength(0);
  });

  it('đặt lại một hoặc tất cả', async () => {
    const { service } = setup();
    await service.set('a', 'cho', 5);
    await service.set('a', 'metro', 0);
    expect((await service.reset('a', 'cho')).changed).toBe(1);
    expect((await service.reset('a')).changed).toBe(0);
  });

  it('tiêu chí lạ → 404, trọng số ngoài 0–5 hoặc lẻ → 400', async () => {
    const { service } = setup();
    await expect(service.set('a', 'khong-co', 3)).rejects.toMatchObject({ status: 404 });
    await expect(service.set('a', 'cho', 6)).rejects.toMatchObject({ status: 400 });
    await expect(service.set('a', 'cho', 2.5)).rejects.toMatchObject({ status: 400 });
  });
});
