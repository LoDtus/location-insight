import { DataSource } from 'typeorm';
import { isolatedDatabaseUrl } from '../../../../test/helpers/geo-test-db.js';
import { MemoryRedis, MemoryStorage } from '../../../../test/helpers/memory-services.js';
import { buildPackage, gzipLines } from '../../../../test/helpers/package-zip.js';
import type { RedisService } from '../../../integrations/redis/redis.service.js';
import type { StorageService } from '../../../integrations/storage/storage.service.js';
import { MapDatasetVersionEntity } from '../entities/map-dataset-version.entity.js';
import { MapDatasetService } from '../map-dataset.service.js';
import { DatasetImportService } from './dataset-import.service.js';
import { GeoLayersService } from './geo-layers.service.js';
import { GeoSchemaService } from './geo-schema.service.js';

/**
 * Test tích hợp trên PostGIS thật (018-location-data AC-01, AC-02, AC-03, AC-11, AC-13). Chỉ chạy khi có
 * GEO_TEST_DATABASE_URL trỏ tới một database TẠM (test xóa schema geo và bảng map_dataset_versions ở đó):
 *   docker run -d --rm --name li-geo-test -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=test \
 *     -p 127.0.0.1:55432:5432 postgis/postgis:17-3.5-alpine
 *   GEO_TEST_DATABASE_URL=postgres://test:test@127.0.0.1:55432/test npx vitest run dataset-pipeline
 */
const DATABASE_URL = process.env.GEO_TEST_DATABASE_URL;
const ADMIN = '00000000-0000-7000-8000-00000000000a';

describe.skipIf(!DATABASE_URL)('đường nhập gói và bản phát hành trên PostGIS', () => {
  let dataSource: DataSource;
  let storage: MemoryStorage;
  let imports: DatasetImportService;
  let layers: GeoLayersService;
  let releases: MapDatasetService;

  async function upload(zip: Buffer): Promise<string> {
    const ticket = await imports.createUploadTicket(ADMIN, zip.length);
    storage.objects.set(`datasets/incoming/${ticket.uploadId}.zip`, zip);
    const job = await imports.submitUpload(ADMIN, ticket.uploadId);
    await imports.drainQueue();
    return job.id;
  }

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: await isolatedDatabaseUrl(DATABASE_URL as string, 'li_test_pipeline'), entities: [MapDatasetVersionEntity], synchronize: false });
    await dataSource.initialize();
    await dataSource.query('DROP SCHEMA IF EXISTS geo CASCADE; DROP SCHEMA IF EXISTS geo_staging CASCADE; DROP TABLE IF EXISTS map_dataset_versions CASCADE');
    await dataSource.synchronize();
    storage = new MemoryStorage();
    const redis = new MemoryRedis() as unknown as RedisService;
    const geoSchema = new GeoSchemaService(dataSource);
    expect(await geoSchema.ensure()).toBe(true);
    layers = new GeoLayersService(dataSource, geoSchema);
    imports = new DatasetImportService(dataSource, storage as unknown as StorageService, redis, geoSchema, layers);
    releases = new MapDatasetService(dataSource.getRepository(MapDatasetVersionEntity), redis, geoSchema, layers);
    await releases.onModuleInit();
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  it('nhập gói điểm: kiểm tra đạt, Lưu thành phiên bản ready có content_hash', async () => {
    await layers.create(ADMIN, { code: 'osm.places', contract: 'point@1', sourceCode: 'osm', usage: 'public', attribution: '© OpenStreetMap', description: '' });
    const csv = 'feature_key,category,kind,name,lat,lng,is_planned,attrs\nosm:n1,market,marketplace,"Chợ Hôm, Hà Nội",21.0152,105.853,false,\nosm:n2,pharmacy,,Nhà thuốc,21.03,105.84,,"{""brand"":""Long Châu""}"\nosm:n3,market,,,21.0,105.8,true,\n';
    const { zip } = buildPackage({ data: Buffer.from(csv), rowCount: 3, categories: { market: 2, pharmacy: 1 } });
    const jobId = await upload(zip);
    const validated = await imports.get(jobId);
    expect(validated.status).toBe('validated');
    expect(validated.checks.filter((item) => item.status === 'fail')).toEqual([]);
    expect(validated.preview).toHaveLength(3);

    const saved = await imports.save(jobId, ADMIN, undefined);
    expect(saved.status).toBe('saved');
    const [version] = (await dataSource.query('SELECT status, row_count, content_hash FROM geo.layer_versions WHERE id = $1', [saved.layerVersionId])) as Array<{
      status: string;
      row_count: number;
      content_hash: string;
    }>;
    expect(version).toMatchObject({ status: 'ready', row_count: 3 });
    expect(version.content_hash).toMatch(/^[0-9a-f]{64}$/);
    const staging = (await dataSource.query('SELECT count(*)::int AS n FROM geo_staging.point_rows')) as Array<{ n: number }>;
    expect(staging[0].n).toBe(0);
  });

  it('chặn ghi thẳng vào geo ngoài đường nhập (AC-11)', async () => {
    const [{ id }] = (await dataSource.query(`SELECT id FROM geo.layer_versions LIMIT 1`)) as Array<{ id: string }>;
    await expect(
      dataSource.query(`INSERT INTO geo.point_features (layer_version_id, feature_key, category, geom) VALUES ($1, 'x', 'market', ST_GeogFromText('POINT(105.8 21)'))`, [id]),
    ).rejects.toThrow(/đường nhập/);
    await expect(dataSource.query(`UPDATE geo.point_features SET name = 'sửa lén'`)).rejects.toThrow(/không sửa/);
    await expect(dataSource.query(`UPDATE geo.layer_versions SET row_count = 99 WHERE id = $1`, [id])).rejects.toThrow(/không sửa được/);
  });

  it('từ chối gói lệch số dòng, cho tải lại sau khi bị từ chối, chặn gói trùng (AC-02, AC-13)', async () => {
    const { zip: mismatch } = buildPackage({ label: '2026-11-20', data: Buffer.from('feature_key,category,lat,lng\nk,market,21,105.8\n'), rowCount: 5 });
    const rejected = await imports.get(await upload(mismatch));
    expect(rejected.status).toBe('rejected');
    expect(rejected.checks.find((item) => item.code === 'row_count_match')?.status).toBe('fail');
    const staging = (await dataSource.query('SELECT count(*)::int AS n FROM geo_staging.point_rows')) as Array<{ n: number }>;
    expect(staging[0].n).toBe(0);
    expect((await imports.get(await upload(mismatch))).status).toBe('rejected');

    const okZip = buildPackage({ label: '2026-12-01', data: Buffer.from('feature_key,category,lat,lng\nk,market,21,105.8\n'), rowCount: 1 }).zip;
    expect((await imports.get(await upload(okZip))).status).toBe('validated');
    const again = await imports.createUploadTicket(ADMIN, okZip.length);
    storage.objects.set(`datasets/incoming/${again.uploadId}.zip`, okZip);
    await expect(imports.submitUpload(ADMIN, again.uploadId)).rejects.toMatchObject({ response: { details: { code: 'PACKAGE_DUPLICATE' } } });
  });

  it('nhập đường (EPSG:4326), vùng và lưới', async () => {
    await layers.create(ADMIN, { code: 'osm.roads', contract: 'line@1', sourceCode: 'osm', usage: 'public', attribution: '© OpenStreetMap', description: '' });
    const line = JSON.stringify({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[105.85, 21.02], [105.86, 21.03]] }, properties: { feature_key: 'osm:w1', category: 'road', road_class: 'primary', width_m: 12 } });
    const roads = buildPackage({ layer: 'osm.roads', contract: 'line@1', data: gzipLines([line]), rowCount: 1, categories: { road: 1 } });
    const roadJob = await upload(roads.zip);
    expect((await imports.get(roadJob)).status).toBe('validated');
    expect((await imports.save(roadJob, ADMIN, undefined)).status).toBe('saved');

    await layers.create(ADMIN, { code: 'qhtd.landuse_current', contract: 'area@1', sourceCode: 'qhtd', usage: 'internal', attribution: 'CSDL quy hoạch', description: '' });
    const bowtie = { type: 'Polygon', coordinates: [[[105.8, 21.0], [105.81, 21.01], [105.81, 21.0], [105.8, 21.01], [105.8, 21.0]]] };
    const area = JSON.stringify({ type: 'Feature', geometry: bowtie, properties: { feature_key: 'qh:1', category: 'landuse_current', code: 'ODT' } });
    const areas = buildPackage({ layer: 'qhtd.landuse_current', contract: 'area@1', data: gzipLines([area]), rowCount: 1 });
    const areaJob = await upload(areas.zip);
    expect((await imports.get(areaJob)).status).toBe('validated');
    expect((await imports.save(areaJob, ADMIN, undefined)).status).toBe('saved');

    await layers.create(ADMIN, { code: 'worldpop.pop_500m', contract: 'grid@1', sourceCode: 'worldpop', usage: 'public', attribution: 'WorldPop', description: '' });
    const grid = buildPackage({ layer: 'worldpop.pop_500m', contract: 'grid@1', data: Buffer.from('cell_id,value\n10,15.5\n11,\n'), rowCount: 2 });
    const gridJob = await upload(grid.zip);
    expect((await imports.get(gridJob)).status).toBe('validated');
    expect((await imports.save(gridJob, ADMIN, undefined)).status).toBe('saved');
  });

  it('bản nháp → phát hành → thu hồi về bản cũ (AC-01, AC-03)', async () => {
    const all = await layers.list();
    const places = all.find((layer) => layer.code === 'osm.places');
    const readyVersion = places?.versions.find((version) => version.status === 'ready');
    expect(readyVersion).toBeDefined();

    const draft = await releases.createDraft(ADMIN, 'data', 'Nhập OSM đầu tiên');
    await expect(releases.createDraft(ADMIN, 'data', 'Bản nháp thứ hai')).rejects.toMatchObject({ response: { details: { code: 'RELEASE_DRAFT_EXISTS' } } });
    await releases.setLayer(draft.version, 'osm.places', readyVersion?.id ?? '');
    await expect(releases.publish(draft.version, ADMIN, undefined)).resolves.toMatchObject({ status: 'published', current: true });
    expect(await releases.current()).toBe(draft.version);

    await expect(dataSource.query(`UPDATE map_dataset_versions SET layer_manifest = '{}' WHERE version = $1`, [draft.version])).rejects.toThrow(/không sửa được/);

    const rollback = await releases.withdraw(draft.version, ADMIN, 'Thử thu hồi', 1);
    expect(rollback).toMatchObject({ kind: 'rollback', status: 'published', baseVersion: 1 });
    const detail = await releases.detail(draft.version);
    expect(detail.status).toBe('withdrawn');
  });
});
