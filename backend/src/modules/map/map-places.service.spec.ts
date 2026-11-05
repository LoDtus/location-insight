import { describe, expect, it } from 'vitest';
import { IsNull, Not } from 'typeorm';
import type { MapEvaluationService } from './map-evaluation.service.js';
import type { MapLimitsService } from './map-limits.service.js';
import type { MapPlaceResolver } from './map-place-resolver.service.js';
import { MapPlacesService, cleanNote } from './map-places.service.js';
import { MAP_COMPARE_MAX } from './map.constants.js';

/**
 * Đặc tả: workspace/features/013-map/README.md §4e (tên gợi nhớ, ghi chú, danh sách so sánh của địa điểm đã lưu).
 * Repository giả trong bộ nhớ.
 */
type Row = { [key: string]: unknown };

const comparedFilter = Not(IsNull());

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (JSON.stringify(expected) === JSON.stringify(comparedFilter)) return row[key] != null;
    return row[key] === expected;
  });
}

function setup() {
  const rows: Row[] = [];
  let seq = 0;
  const repo = {
    rows,
    create: (value: Row) => ({ ...value }),
    async save(value: Row): Promise<Row> {
      if (!value.id) {
        const saved = { id: `saved-${++seq}`, createdAt: new Date(), label: null, note: '', comparedAt: null, ...value };
        rows.push(saved);
        return saved;
      }
      return value;
    },
    async findOne({ where }: { where: Row }) {
      return rows.find((row) => matches(row, where)) ?? null;
    },
    async find({ where }: { where: Row }) {
      return rows.filter((row) => matches(row, where));
    },
    async count({ where }: { where: Row }) {
      return rows.filter((row) => matches(row, where)).length;
    },
  };
  let placeSeq = 0;
  const service = new MapPlacesService(
    repo as never,
    {
      summaries: async () => new Map(),
      latestViews: async (userId: string) => new Map(userId === 'user-a' ? [['place-1', { overall: 7 }]] : []),
    } as unknown as MapEvaluationService,
    { resolve: async () => ({ id: `place-${++placeSeq}` }) } as unknown as MapPlaceResolver,
    { consumeUser: async () => undefined } as unknown as MapLimitsService,
  );
  return { service, rows };
}

async function saveOne(service: MapPlacesService, userId: string, index: number) {
  return service.save(userId, { lat: 21 + index / 1000, lng: 105.8, name: `Địa điểm ${index}` });
}

describe('MapPlacesService – tên gợi nhớ, ghi chú, so sánh', () => {
  it('đặt tên gợi nhớ và ghi chú cho mục của chính mình; chuỗi rỗng bỏ tên gợi nhớ', async () => {
    const { service } = setup();
    const item = await saveOne(service, 'user-a', 1);
    const named = await service.update('user-a', item.id, { label: '  Nhà bà ngoại  ', note: 'Gần chợ\r\n\r\n\r\nĐỗ xe được' });
    expect(named.label).toBe('Nhà bà ngoại');
    expect(named.note).toBe('Gần chợ\n\nĐỗ xe được');
    expect((await service.update('user-a', item.id, { label: '' })).label).toBeNull();
  });

  it('không sửa được mục của người khác (404 như không tồn tại)', async () => {
    const { service } = setup();
    const item = await saveOne(service, 'user-a', 1);
    await expect(service.update('user-b', item.id, { note: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it(`so sánh tối đa ${MAP_COMPARE_MAX} địa điểm; vượt thì 409`, async () => {
    const { service } = setup();
    const items = [];
    for (let index = 0; index <= MAP_COMPARE_MAX; index += 1) items.push(await saveOne(service, 'user-a', index));
    for (const item of items.slice(0, MAP_COMPARE_MAX)) await service.update('user-a', item.id, { compared: true });
    await expect(service.update('user-a', items[MAP_COMPARE_MAX].id, { compared: true })).rejects.toMatchObject({ status: 409 });
    await service.update('user-a', items[0].id, { compared: false });
    expect((await service.update('user-a', items[MAP_COMPARE_MAX].id, { compared: true })).compared).toBe(true);
  });

  it('bảng so sánh chỉ gồm mục đang so sánh của chính người dùng, đánh giá lấy từ lượt của chính họ', async () => {
    const { service } = setup();
    const mine = await saveOne(service, 'user-a', 1);
    await saveOne(service, 'user-a', 2);
    const other = await saveOne(service, 'user-b', 3);
    await service.update('user-a', mine.id, { compared: true });
    await service.update('user-b', other.id, { compared: true });
    const table = await service.compare('user-a');
    expect(table.map((item) => item.id)).toEqual([mine.id]);
    expect(table[0].evaluation).toMatchObject({ overall: 7 });
    expect((await service.compare('user-b'))[0].evaluation).toBeNull();
  });
});

describe('cleanNote', () => {
  it('giữ xuống dòng, bỏ ký tự điều khiển, cắt 1000 ký tự', () => {
    expect(cleanNote('a\u0007b\tc\nd')).toBe('a b c\nd');
    expect(cleanNote('x'.repeat(1200))).toHaveLength(1000);
  });
});
