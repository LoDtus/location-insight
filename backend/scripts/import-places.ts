/**
 * Nhập điểm tiện ích đã gộp trùng (data/curated/places/{phien-ban}/places.ndjson) vào bảng map_pois.
 * Thay toàn bộ điểm của cùng nguồn trong một giao dịch. Dữ liệu đọc từ stdin để chạy được trong container:
 *
 *   docker exec -i location-insight-backend npx tsx scripts/import-places.ts --source osm --version 2026-10-18 \
 *     < data/curated/places/2026-10-18/places.ndjson
 */
import '../src/load-env.js';
import { createInterface } from 'node:readline';
import { DataSource } from 'typeorm';
import { MapPoiEntity } from '../src/modules/map/entities/map-poi.entity.js';
import { MAP_POI_CATEGORIES, VN_BOUNDS } from '../src/modules/map/map.constants.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const source = argument('source') ?? '';
const version = argument('version') ?? '';
if (!/^[a-z-]{2,20}$/.test(source) || !/^[\w.-]{4,20}$/.test(version)) {
  console.error('Cách dùng: npx tsx scripts/import-places.ts --source osm --version 2026-10-18 < places.ndjson');
  process.exit(1);
}

const categories = new Set<string>(MAP_POI_CATEGORIES);
const [minLng, minLat, maxLng, maxLat] = VN_BOUNDS;

function text(value: unknown, max: number): string {
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

/** Kiểm tra từng dòng: sai thì bỏ, không nhập bừa. */
function parse(line: string): Omit<MapPoiEntity, 'id'> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const lat = row.lat;
  const lng = row.lng;
  const category = text(row.category, 20);
  const sourceId = text(row.sourceId, 40);
  if (typeof lat !== 'number' || typeof lng !== 'number' || !categories.has(category) || !sourceId) return null;
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return null;
  return { category, kind: text(row.kind, 30), name: text(row.name, 160), lat, lng, source, sourceId, sourceVersion: version };
}

const rows: Array<Omit<MapPoiEntity, 'id'>> = [];
let skipped = 0;
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  const row = parse(line);
  if (row) rows.push(row);
  else skipped += 1;
}
if (rows.length === 0) {
  console.error('Không có dòng hợp lệ nào; không đổi dữ liệu.');
  process.exit(1);
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [MapPoiEntity],
  synchronize: false,
});

await dataSource.initialize();
try {
  await dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(MapPoiEntity);
    await repo.delete({ source });
    for (let index = 0; index < rows.length; index += 1000) {
      await repo.insert(rows.slice(index, index + 1000));
    }
  });
  console.log(`Đã nhập ${rows.length} điểm (${source} ${version}), bỏ ${skipped} dòng sai.`);
  console.log('Cache ô lớp bản đồ tự hết hiệu lực trong 60 giây (khóa theo phiên bản dữ liệu).');
} finally {
  await dataSource.destroy();
}
