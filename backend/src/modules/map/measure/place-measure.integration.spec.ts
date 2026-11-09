import { DataSource } from 'typeorm';
import { isolatedDatabaseUrl } from '../../../../test/helpers/geo-test-db.js';
import { MemoryRedis, MemoryStorage } from '../../../../test/helpers/memory-services.js';
import { buildPackage, gzipLines } from '../../../../test/helpers/package-zip.js';
import type { RedisService } from '../../../integrations/redis/redis.service.js';
import type { StorageService } from '../../../integrations/storage/storage.service.js';
import { DatasetImportService } from '../datasets/dataset-import.service.js';
import { GeoLayersService } from '../datasets/geo-layers.service.js';
import { GeoSchemaService } from '../datasets/geo-schema.service.js';
import { MapDatasetVersionEntity } from '../entities/map-dataset-version.entity.js';
import { MapDatasetService } from '../map-dataset.service.js';
import type { MapService } from '../map.service.js';
import { buildEvaluation, type CriterionMeasurement } from '../place-evaluation.js';
import type { OpenAqClient } from './openaq.client.js';
import { PlaceMeasureService } from './place-measure.service.js';

/**
 * Đo thật trên PostGIS (018-location-data FR-10, AC-07, AC-08): nhập gói qua đúng đường nhập, phát hành, rồi đo
 * một tọa độ. Chỉ chạy khi có GEO_TEST_DATABASE_URL trỏ tới database TẠM (xem dataset-pipeline.spec.ts).
 */
const DATABASE_URL = process.env.GEO_TEST_DATABASE_URL;
const ADMIN = '00000000-0000-7000-8000-00000000000b';
/** Điểm đo: cách Hồ Gươm ~445 m về phía bắc. */
const P = { lat: 21.0325, lng: 105.852 };

function offset(northM: number, eastM: number): { lat: number; lng: number } {
  return { lat: P.lat + northM / 111320, lng: P.lng + eastM / (111320 * Math.cos((P.lat * Math.PI) / 180)) };
}

function placeRow(key: string, category: string, kind: string, name: string, northM: number, eastM: number): string {
  const at = offset(northM, eastM);
  return `${key},${category},${kind},${name},${at.lat.toFixed(7)},${at.lng.toFixed(7)},false,`;
}

function lineFeature(key: string, roadClass: string, northM: number, name: string): string {
  const a = offset(northM, -800);
  const b = offset(northM, 800);
  return JSON.stringify({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
    properties: { feature_key: key, category: 'road', road_class: roadClass, name },
  });
}

class FakeMaps {
  failing = false;
  calls = 0;
  async travelMinutes(_origin: unknown, destinations: ReadonlyArray<{ lat: number; lng: number }>): Promise<Array<number | null>> {
    this.calls += 1;
    if (this.failing) throw new Error('hết ngân sách');
    // 1 phút cho mỗi 300 m đường chim bay (giả).
    return destinations.map((point) => Math.round((Math.hypot((point.lat - P.lat) * 111320, (point.lng - P.lng) * 104000) / 300) * 10) / 10);
  }
}

describe.skipIf(!DATABASE_URL)('đo tiêu chí trên PostGIS', () => {
  let dataSource: DataSource;
  let measurer: PlaceMeasureService;
  let maps: FakeMaps;
  let version: number;

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: await isolatedDatabaseUrl(DATABASE_URL as string, 'li_test_measure'), entities: [MapDatasetVersionEntity], synchronize: false });
    await dataSource.initialize();
    await dataSource.query('DROP SCHEMA IF EXISTS geo CASCADE; DROP SCHEMA IF EXISTS geo_staging CASCADE; DROP TABLE IF EXISTS map_dataset_versions CASCADE');
    await dataSource.synchronize();
    const storage = new MemoryStorage();
    const redis = new MemoryRedis() as unknown as RedisService;
    const geoSchema = new GeoSchemaService(dataSource);
    expect(await geoSchema.ensure()).toBe(true);
    const layers = new GeoLayersService(dataSource, geoSchema);
    const imports = new DatasetImportService(dataSource, storage as unknown as StorageService, redis, geoSchema, layers);
    const releases = new MapDatasetService(dataSource.getRepository(MapDatasetVersionEntity), redis, geoSchema, layers);
    await releases.onModuleInit();

    async function load(code: string, contract: 'point@1' | 'line@1' | 'grid@1', data: Buffer, rowCount: number, categories: Record<string, number> = {}): Promise<string> {
      await layers.create(ADMIN, { code, contract, sourceCode: code.split('.')[0], usage: 'public', attribution: 'test', description: '' });
      const { zip } = buildPackage({ layer: code, contract, data, rowCount, categories });
      const ticket = await imports.createUploadTicket(ADMIN, zip.length);
      storage.objects.set(`datasets/incoming/${ticket.uploadId}.zip`, zip);
      const job = await imports.submitUpload(ADMIN, ticket.uploadId);
      await imports.drainQueue();
      const view = await imports.get(job.id);
      expect(view.status, `${code}: ${JSON.stringify(view.checks.filter((c) => c.status === 'fail'))}`).toBe('validated');
      const saved = await imports.save(job.id, ADMIN, 'test');
      return saved.layerVersionId ?? '';
    }

    const places = [
      'feature_key,category,kind,name,lat,lng,is_planned,attrs',
      placeRow('osm:m1', 'market', 'marketplace', 'Chợ gần', 200, 0),
      placeRow('osm:m2', 'market', 'marketplace', 'Chợ xa', 0, 900),
      placeRow('osm:ph1', 'pharmacy', 'pharmacy', 'Nhà thuốc', -1000, 0),
      placeRow('osm:h1', 'hospital', 'hospital', 'Bệnh viện A', 1500, 0),
      placeRow('osm:h2', 'hospital', 'hospital', 'Bệnh viện B', 0, -2500),
      placeRow('osm:c1', 'hospital', 'clinic', 'Phòng khám', 100, 0),
      placeRow('osm:b1', 'bus', 'bus_stop', 'Điểm dừng', 0, 100),
      placeRow('osm:s1', 'school', 'kindergarten', 'Mầm non Hoa Sen', 250, 0),
      placeRow('osm:s2', 'school', 'school', 'Tiểu học A', 0, 400),
      placeRow('osm:s3', 'school', 'school', 'THCS B', -700, 0),
      placeRow('osm:s4', 'school', 'school', 'THPT C', -1500, 0),
      ...[50, 120, 200, 260, 330].map((m, i) => placeRow(`osm:f${i}`, 'food', 'cafe', `Quán ${i}`, -m, m / 2)),
    ];
    const placeCounts = { market: 2, pharmacy: 1, hospital: 3, bus: 1, food: 5, school: 4 };
    const manifest: Record<string, string> = {};
    manifest['osm.places'] = await load('osm.places', 'point@1', Buffer.from(`${places.join('\n')}\n`), places.length - 1, placeCounts);
    manifest['osm.roads'] = await load('osm.roads', 'line@1', gzipLines([lineFeature('osm:w1', 'primary', 100, 'Phố Lớn'), lineFeature('osm:w2', 'trunk', 1000, 'Đường Trục')]), 2, { road: 2 });

    // Ô lưới chứa P và các ô quanh (cell_id = hàng × 878 + cột, VN-2000 / UTM 48N).
    const [{ x, y }] = (await dataSource.query('SELECT ST_X(p) AS x, ST_Y(p) AS y FROM ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3405) AS p', [P.lng, P.lat])) as Array<{ x: number; y: number }>;
    const col = Math.floor((x - 523600) / 100);
    const row = Math.floor((y - 2268000) / 100);
    const cells = (fn: (dr: number, dc: number) => string): Buffer => {
      const lines = ['cell_id,value'];
      for (let dr = -6; dr <= 6; dr += 1) for (let dc = -6; dc <= 6; dc += 1) lines.push(`${(row + dr) * 878 + (col + dc)},${fn(dr, dc)}`);
      return Buffer.from(`${lines.join('\n')}\n`);
    };
    manifest['worldpop.pop_100m'] = await load('worldpop.pop_100m', 'grid@1', cells(() => '200'), 169);
    manifest['esa.green_100m'] = await load('esa.green_100m', 'grid@1', cells((dr) => (dr < 0 ? '40' : '10')), 169);
    manifest['jrc.flood_rp100'] = await load('jrc.flood_rp100', 'grid@1', cells((dr, dc) => (dr === 0 && dc === 0 ? '1.2' : '0')), 169);
    manifest['fabdem.elev_100m'] = await load('fabdem.elev_100m', 'grid@1', cells((dr, dc) => (dr === 0 && dc === 0 ? '9.5' : '8')), 169);

    const draft = await releases.createDraft(ADMIN, 'data', 'đo thử');
    for (const [code, id] of Object.entries(manifest)) await releases.setLayer(draft.version, code, id);
    version = (await releases.publish(draft.version, ADMIN, 'test')).version;

    maps = new FakeMaps();
    const air = { nearestPm25: async () => ({ kind: 'unavailable', reason: 'Chưa cấu hình OPENAQ_API_KEY.' }) } as unknown as OpenAqClient;
    measurer = new PlaceMeasureService(dataSource, geoSchema, releases, maps as unknown as MapService, air);
  }, 60_000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  function byId(items: CriterionMeasurement[]): Map<string, CriterionMeasurement> {
    return new Map(items.map((item) => [item.id, item]));
  }

  it('đo đủ mọi tiêu chí với nguồn gốc, khoảng cách đúng, dưới 300 ms', async () => {
    await measurer.measure(P.lat, P.lng, version); // làm nóng kết nối
    const started = Date.now();
    const items = byId(await measurer.measure(P.lat, P.lng, version));
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(300);

    const market = items.get('cho');
    expect(market?.status).toBe('ok');
    expect(market?.value).toBeGreaterThan(190);
    expect(market?.value).toBeLessThan(210);
    expect(market?.evidence?.[0]?.name).toBe('Chợ gần');
    expect(market?.layerVersions).toHaveLength(1);
    expect(market?.method).toBe('nearest@1');
    // Nguồn theo ghi công của lớp đã đọc (lớp demo hiện đúng tên của nó), thời gian đi ghi thêm Vietmap.
    expect(market?.source).toBe('test');

    // Phòng khám không phải bệnh viện (lọc theo kind); thời gian đi lấy từ Matrix, chọn đích nhanh nhất.
    const hospital = items.get('benh-vien');
    expect(hospital?.status).toBe('ok');
    expect(hospital?.unit).toBe('phút');
    expect(hospital?.evidence?.[0]?.name).toBe('Bệnh viện A');
    expect(hospital?.expiresAt).toBeTruthy();
    expect(hospital?.source).toBe('test, thời gian đi: Vietmap');

    expect(items.get('quan-an')).toMatchObject({ status: 'ok', value: 5, radiusM: 500 });
    // Dẫn chứng vẽ trên bản đồ: từng quán trong 500 m, ô lưới quanh địa điểm, vòng ngưỡng đạt trọn điểm.
    expect(items.get('quan-an')?.evidence).toHaveLength(5);
    expect(items.get('mat-do-dan-cu')?.cells).toHaveLength(81);
    expect(items.get('mat-do-dan-cu')?.cellM).toBe(100);
    // Ngập sông: điểm theo ô chứa địa điểm, dẫn chứng thêm các ô trong 300 m (29 ô).
    const floodCells = items.get('ngap-song')?.cells ?? [];
    expect(floodCells).toHaveLength(29);
    const wet = floodCells.find((cell) => cell.value > 0);
    expect(Math.abs((wet?.lat ?? 0) - P.lat)).toBeLessThan(0.001);
    expect(Math.abs((wet?.lng ?? 0) - P.lng)).toBeLessThan(0.001);
    expect(items.get('cho')?.radiusM).toBe(300);
    // Nhiều lựa chọn kèm số phút (lượt Matrix dẫn chứng), sắp theo khoảng cách.
    expect(items.get('cho')?.evidence?.map((item) => item.name)).toEqual(['Chợ gần', 'Chợ xa']);
    expect(items.get('cho')?.evidence?.every((item) => typeof item.minutes === 'number')).toBe(true);
    // Trường: mầm non gần nhất + 2 trường phổ thông gần nhất, gắn nhóm; THPT C (xa hơn) không vào.
    expect(items.get('truong-hoc')?.evidence?.map((item) => `${item.group}:${item.name}`)).toEqual([
      'Mầm non:Mầm non Hoa Sen',
      'Phổ thông:Tiểu học A',
      'Phổ thông:THCS B',
    ]);
    // Đường lớn: hình dạng đoạn đường trong 600 m; ồn: đường trục xa hơn 600 m nên không có vùng ồn.
    expect(items.get('duong-lon')?.paths?.length).toBeGreaterThan(0);
    expect(items.get('duong-lon')?.paths?.[0]?.length).toBeGreaterThanOrEqual(2);
    expect(items.get('on-giao-thong')?.zones).toEqual([]);
    expect(items.get('xe-buyt')?.autoScore).toBe(10);
    expect(items.get('metro')).toMatchObject({ status: 'no_data' });
    expect(items.get('duong-lon')?.detail).toMatch(/Phố Lớn/);
    expect(items.get('on-giao-thong')?.value).toBeGreaterThan(950);
    expect(items.get('noi-do')).toMatchObject({ status: 'ok', unit: 'phút' });
    expect(items.get('mat-do-dan-cu')).toMatchObject({ status: 'ok', value: 81 * 200 });
    expect(items.get('mang-xanh')?.value).toBeGreaterThan(10);
    expect(items.get('mang-xanh')?.value).toBeLessThan(40);
    expect(items.get('ngap-song')).toMatchObject({ status: 'ok', value: 1.2, blockingHit: true });
    expect(items.get('do-cao')).toMatchObject({ status: 'ok', value: 1.5 });
    expect(items.get('khong-khi')).toMatchObject({ status: 'unavailable' });
    expect(items.get('ngap-ung')).toMatchObject({ status: 'not_implemented' });

    const evaluation = buildEvaluation(P.lat, P.lng, [...items.values()], []);
    expect(evaluation.blocking.map((item) => item.criterionId)).toEqual(['ngap-song']);
    expect(evaluation.overall).toBeLessThanOrEqual(4);
    // Mỗi lượt đo 2 lượt Matrix (chấm điểm + dẫn chứng), đo 2 lần (làm nóng + đo).
    expect(maps.calls).toBe(4);
  });

  it('Vietmap lỗi: thời gian đi chuyển sang khoảng cách, hạ độ tin, các tiêu chí khác không ảnh hưởng', async () => {
    maps.failing = true;
    const items = byId(await measurer.measure(P.lat, P.lng, version));
    maps.failing = false;
    expect(items.get('benh-vien')).toMatchObject({ status: 'fallback', confidence: 'medium', unit: 'm' });
    expect(items.get('noi-do')).toMatchObject({ status: 'fallback', unit: 'm' });
    expect(items.get('cho')?.status).toBe('ok');
  });

  it('bản phát hành không có lớp: tiêu chí ghi chưa có dữ liệu, không ném lỗi', async () => {
    const items = byId(await measurer.measure(P.lat, P.lng, 1));
    expect(items.get('cho')).toMatchObject({ status: 'no_data' });
    expect(items.get('mat-do-dan-cu')).toMatchObject({ status: 'no_data' });
    expect(items.get('noi-do')?.status).toBe('ok');
  });
});
