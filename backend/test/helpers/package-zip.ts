import { createHash } from 'node:crypto';
import { crc32, deflateRawSync, gzipSync } from 'node:zlib';

/** Dựng zip trong bộ nhớ cho test (khuôn gói 018). Cho phép khai sai kích thước để thử zip bomb. */
export interface ZipFixtureEntry {
  name: string;
  data: Buffer;
  method?: 'store' | 'deflate';
  /** Ghi đè kích thước giải nén khai trong mục lục (mặc định đúng). */
  declaredSize?: number;
  /** Ghi đè CRC khai trong mục lục (mặc định đúng). */
  declaredCrc?: number;
  /** Đánh dấu symlink trong external attributes. */
  isSymlink?: boolean;
}

export function buildZip(entries: readonly ZipFixtureEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const isDeflate = (entry.method ?? 'deflate') === 'deflate';
    const payload = isDeflate ? deflateRawSync(entry.data) : entry.data;
    const crc = entry.declaredCrc ?? crc32(entry.data);
    const size = entry.declaredSize ?? entry.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(isDeflate ? 8 : 0, 8);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(isDeflate ? 8 : 0, 10);
    central.writeUInt32LE(crc >>> 0, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.isSymlink ? (0o120777 << 16) >>> 0 : (0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + payload.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export interface PackageFixtureOptions {
  layer?: string;
  label?: string;
  contract?: 'point@1' | 'line@1' | 'area@1' | 'grid@1';
  data: Buffer;
  rowCount: number;
  categories?: Record<string, number>;
  crs?: string;
  gridCode?: string;
  extra?: Record<string, unknown>;
}

/** Gói chuẩn hợp lệ (manifest + dữ liệu) để thử đường nhập. */
export function buildPackage(options: PackageFixtureOptions): { zip: Buffer; manifest: Record<string, unknown> } {
  const contract = options.contract ?? 'point@1';
  const dataFile = contract === 'line@1' || contract === 'area@1' ? 'data.geojsonl.gz' : 'data.csv';
  const manifest: Record<string, unknown> = {
    contract,
    layer: options.layer ?? 'osm.places',
    label: options.label ?? '2026-11-01',
    sourceDate: '2026-11-01',
    crs: options.crs ?? (contract === 'grid@1' ? 'EPSG:3405' : 'EPSG:4326'),
    sources: [
      {
        catalog: 'data/catalog/snapshots/places/osm/2026-11-01.json',
        url: 'https://download.geofabrik.de/asia/vietnam-latest.osm.pbf',
        sha256: 'a'.repeat(64),
        license: 'ODbL-1.0',
      },
    ],
    pipeline: { tool: 'tools/data/osm_places.py', commit: 'abc1234', dirty: false },
    manualSteps: [],
    rowCount: options.rowCount,
    categories: options.categories ?? {},
    dataSha256: sha256(options.data),
    ...(contract === 'grid@1' ? { gridCode: options.gridCode ?? 'vn2000-100m', params: { radius_m: 500 } } : {}),
    ...options.extra,
  };
  const zip = buildZip([
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) },
    { name: dataFile, data: options.data, method: dataFile.endsWith('.gz') ? 'store' : 'deflate' },
  ]);
  return { zip, manifest };
}

export function gzipLines(lines: readonly string[]): Buffer {
  return gzipSync(Buffer.from(`${lines.join('\n')}\n`));
}
