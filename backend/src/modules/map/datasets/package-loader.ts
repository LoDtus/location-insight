import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import type { QueryRunner } from 'typeorm';
import { readCsvRecords } from './csv-reader.js';
import { PACKAGE_LIMITS, PACKAGE_PATTERNS, ROAD_CLASSES, type ContractSpec, type GeometryKind } from './package-contracts.js';

/**
 * Nạp tệp dữ liệu của gói vào `geo_staging` theo khuôn (package-contracts.md mục 3). Dòng sai khuôn không được nạp;
 * lỗi được đếm và giữ 20 lỗi đầu để admin sửa. Mọi giá trị đi qua tham số, không ghép SQL.
 */

export interface LoadResult {
  totalRows: number;
  loadedRows: number;
  headerError: string | null;
  rowErrorCount: number;
  rowErrors: string[];
}

export class PackageDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageDataError';
  }
}

const BATCH_SIZE = 500;
const ROW_ERRORS_KEPT = 20;
const GEOJSON_LINE_MAX_CHARS = 16 * 1024 * 1024;
const GZIP_MAGIC = [0x1f, 0x8b];
const RECORD_SEPARATOR = String.fromCharCode(0x1e);
const NAME_MAX = 200;
const KIND_MAX = 30;
const CODE_MAX = 30;

class RowCollector {
  readonly result: LoadResult = { totalRows: 0, loadedRows: 0, headerError: null, rowErrorCount: 0, rowErrors: [] };

  fail(lineNo: number, message: string): void {
    this.result.rowErrorCount += 1;
    if (this.result.rowErrors.length < ROW_ERRORS_KEPT) this.result.rowErrors.push(`Dòng ${lineNo}: ${message}`);
  }
}

export async function loadPackageData(
  runner: QueryRunner,
  jobId: string,
  geometryKind: GeometryKind,
  spec: ContractSpec,
  dataPath: string,
  srid: number,
): Promise<LoadResult> {
  if (geometryKind === 'point') return loadPointCsv(runner, jobId, spec, dataPath);
  if (geometryKind === 'grid') return loadGridCsv(runner, jobId, spec, dataPath);
  return loadGeoJsonSeq(runner, jobId, geometryKind, spec, dataPath, srid);
}

// ───────────────────────────── CSV ─────────────────────────────

function headerIndex(header: readonly string[], spec: ContractSpec): { index: Map<string, number>; error: string | null } {
  const allowed = new Set(spec.columns ?? []);
  const index = new Map<string, number>();
  for (const [position, raw] of header.entries()) {
    const name = raw.trim();
    if (!allowed.has(name)) return { index, error: `Cột "${name.slice(0, 40)}" không có trong khuôn.` };
    if (index.has(name)) return { index, error: `Cột "${name}" bị lặp.` };
    index.set(name, position);
  }
  const missing = (spec.requiredColumns ?? []).filter((name) => !index.has(name));
  return { index, error: missing.length ? `Thiếu cột bắt buộc: ${missing.join(', ')}.` : null };
}

function openCsv(dataPath: string): Readable {
  return createReadStream(dataPath);
}

async function assertTextFile(dataPath: string): Promise<void> {
  const handle = await open(dataPath, 'r');
  try {
    const sample = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
    if (sample.subarray(0, bytesRead).includes(0)) throw new PackageDataError('data.csv không phải tệp văn bản (có byte 0).');
  } finally {
    await handle.close();
  }
}

interface PointRow {
  lineNo: number;
  featureKey: string;
  category: string;
  kind: string;
  name: string;
  isPlanned: boolean;
  attrs: string;
  lat: number;
  lng: number;
}

async function loadPointCsv(runner: QueryRunner, jobId: string, spec: ContractSpec, dataPath: string): Promise<LoadResult> {
  await assertTextFile(dataPath);
  const collector = new RowCollector();
  let columns: Map<string, number> | null = null;
  let lineNo = 0;
  let batch: PointRow[] = [];
  for await (const record of readCsvRecords(openCsv(dataPath), PACKAGE_LIMITS.csvLineMaxBytes)) {
    lineNo += 1;
    if (!columns) {
      const parsed = headerIndex(record, spec);
      if (parsed.error) {
        collector.result.headerError = parsed.error;
        return collector.result;
      }
      columns = parsed.index;
      continue;
    }
    collector.result.totalRows += 1;
    const cell = (name: string): string => {
      const position = columns?.get(name);
      return position === undefined ? '' : (record[position] ?? '').trim();
    };
    if (record.length !== columns.size) {
      collector.fail(lineNo, `có ${record.length} ô, khuôn cần ${columns.size}.`);
      continue;
    }
    const common = readCommon(cell('feature_key'), cell('category'), cell('name'), cell('is_planned'), cell('attrs'));
    const kind = cell('kind');
    const lat = Number(cell('lat'));
    const lng = Number(cell('lng'));
    const problem =
      common.error ??
      (kind.length > KIND_MAX ? `kind dài quá ${KIND_MAX} ký tự.` : null) ??
      (cell('lat') === '' || !Number.isFinite(lat) || lat < -90 || lat > 90 ? 'lat không hợp lệ.' : null) ??
      (cell('lng') === '' || !Number.isFinite(lng) || lng < -180 || lng > 180 ? 'lng không hợp lệ.' : null);
    if (problem || !common.value) {
      collector.fail(lineNo, problem ?? 'dòng không hợp lệ.');
      continue;
    }
    batch.push({ lineNo, ...common.value, kind, lat, lng });
    if (batch.length >= BATCH_SIZE) {
      collector.result.loadedRows += await insertPoints(runner, jobId, batch);
      batch = [];
    }
  }
  if (!columns) collector.result.headerError = 'data.csv rỗng (thiếu dòng tiêu đề).';
  if (batch.length) collector.result.loadedRows += await insertPoints(runner, jobId, batch);
  return collector.result;
}

async function insertPoints(runner: QueryRunner, jobId: string, rows: readonly PointRow[]): Promise<number> {
  await runner.query(
    `INSERT INTO geo_staging.point_rows (job_id, line_no, feature_key, category, kind, name, is_planned, attrs, geom)
     SELECT $1, t.line_no, t.feature_key, t.category, t.kind, t.name, t.is_planned, t.attrs::jsonb,
            ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326)
     FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::text[], $7::boolean[], $8::text[], $9::float8[], $10::float8[])
       AS t(line_no, feature_key, category, kind, name, is_planned, attrs, lat, lng)`,
    [
      jobId,
      rows.map((row) => row.lineNo),
      rows.map((row) => row.featureKey),
      rows.map((row) => row.category),
      rows.map((row) => row.kind),
      rows.map((row) => row.name),
      rows.map((row) => row.isPlanned),
      rows.map((row) => row.attrs),
      rows.map((row) => row.lat),
      rows.map((row) => row.lng),
    ],
  );
  return rows.length;
}

async function loadGridCsv(runner: QueryRunner, jobId: string, spec: ContractSpec, dataPath: string): Promise<LoadResult> {
  await assertTextFile(dataPath);
  const collector = new RowCollector();
  let columns: Map<string, number> | null = null;
  let lineNo = 0;
  let batch: Array<{ lineNo: number; cellId: string; value: number | null }> = [];
  const flush = async (): Promise<void> => {
    if (!batch.length) return;
    await runner.query(
      `INSERT INTO geo_staging.grid_rows (job_id, line_no, cell_id, value)
       SELECT $1, t.line_no, t.cell_id, t.value FROM unnest($2::int[], $3::bigint[], $4::float8[]) AS t(line_no, cell_id, value)`,
      [jobId, batch.map((row) => row.lineNo), batch.map((row) => row.cellId), batch.map((row) => row.value)],
    );
    collector.result.loadedRows += batch.length;
    batch = [];
  };
  for await (const record of readCsvRecords(openCsv(dataPath), PACKAGE_LIMITS.csvLineMaxBytes)) {
    lineNo += 1;
    if (!columns) {
      const parsed = headerIndex(record, spec);
      if (parsed.error) {
        collector.result.headerError = parsed.error;
        return collector.result;
      }
      columns = parsed.index;
      continue;
    }
    collector.result.totalRows += 1;
    const cellId = (record[columns.get('cell_id') ?? -1] ?? '').trim();
    const rawValue = (record[columns.get('value') ?? -1] ?? '').trim();
    const value = rawValue === '' ? null : Number(rawValue);
    if (record.length !== columns.size || !/^\d{1,15}$/.test(cellId)) {
      collector.fail(lineNo, 'cell_id phải là số nguyên không âm.');
      continue;
    }
    if (value !== null && !Number.isFinite(value)) {
      collector.fail(lineNo, 'value phải là số hoặc để trống.');
      continue;
    }
    batch.push({ lineNo, cellId, value });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  if (!columns) collector.result.headerError = 'data.csv rỗng (thiếu dòng tiêu đề).';
  await flush();
  return collector.result;
}

// ───────────────────────────── GeoJSONSeq (gzip) ─────────────────────────────

interface FeatureRow {
  lineNo: number;
  featureKey: string;
  category: string;
  name: string;
  isPlanned: boolean;
  attrs: string;
  geometry: string;
  roadClass: string | null;
  widthM: number | null;
  code: string | null;
  validFrom: string | null;
  validTo: string | null;
}

async function assertGzip(dataPath: string): Promise<void> {
  const handle = await open(dataPath, 'r');
  try {
    const head = Buffer.alloc(2);
    await handle.read(head, 0, 2, 0);
    if (head[0] !== GZIP_MAGIC[0] || head[1] !== GZIP_MAGIC[1]) throw new PackageDataError('data.geojsonl.gz không phải tệp gzip.');
  } finally {
    await handle.close();
  }
}

/** Tách dòng từ stream, giới hạn độ dài một dòng. */
export async function* readLines(input: Readable, maxChars: number): AsyncGenerator<string> {
  let buffer = '';
  input.setEncoding('utf8');
  for await (const chunk of input) {
    buffer += String(chunk);
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      yield buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
    if (buffer.length > maxChars) throw new PackageDataError(`Một dòng GeoJSON dài quá ${maxChars} ký tự.`);
  }
  if (buffer.length > 0) yield buffer.replace(/\r$/, '');
}

async function loadGeoJsonSeq(
  runner: QueryRunner,
  jobId: string,
  geometryKind: GeometryKind,
  spec: ContractSpec,
  dataPath: string,
  srid: number,
): Promise<LoadResult> {
  await assertGzip(dataPath);
  const collector = new RowCollector();
  const allowedProperties = new Set(spec.properties ?? []);
  let lineNo = 0;
  let batch: FeatureRow[] = [];
  const flush = async (): Promise<void> => {
    if (!batch.length) return;
    try {
      collector.result.loadedRows += geometryKind === 'line' ? await insertLines(runner, jobId, batch, srid) : await insertAreas(runner, jobId, batch, srid);
    } catch (error) {
      const first = batch[0]?.lineNo ?? 0;
      const last = batch[batch.length - 1]?.lineNo ?? 0;
      throw new PackageDataError(`Dòng ${first}–${last}: PostGIS không đọc được hình học (${error instanceof Error ? error.message.slice(0, 200) : 'lỗi không rõ'}).`);
    }
    batch = [];
  };
  const stream = createReadStream(dataPath).pipe(createGunzip());
  for await (const line of readLines(stream, GEOJSON_LINE_MAX_CHARS)) {
    lineNo += 1;
    // RFC 8142 cho phép ký tự RS (0x1E) đứng đầu mỗi bản ghi.
    const text = (line.startsWith(RECORD_SEPARATOR) ? line.slice(1) : line).trim();
    if (text === '') continue;
    collector.result.totalRows += 1;
    const parsed = parseFeature(text, spec, allowedProperties, geometryKind);
    if ('error' in parsed) {
      collector.fail(lineNo, parsed.error);
      continue;
    }
    batch.push({ lineNo, ...parsed.row });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  return collector.result;
}

function parseFeature(
  raw: string,
  spec: ContractSpec,
  allowedProperties: ReadonlySet<string>,
  geometryKind: GeometryKind,
): { row: Omit<FeatureRow, 'lineNo'> } | { error: string } {
  let feature: unknown;
  try {
    feature = JSON.parse(raw);
  } catch {
    return { error: 'không phải JSON hợp lệ.' };
  }
  if (!isRecord(feature) || feature.type !== 'Feature' || !isRecord(feature.geometry) || !isRecord(feature.properties)) {
    return { error: 'phải là một GeoJSON Feature có geometry và properties.' };
  }
  const geometryType = feature.geometry.type;
  if (typeof geometryType !== 'string' || !(spec.geometryTypes ?? []).includes(geometryType)) {
    return { error: `geometry phải là ${(spec.geometryTypes ?? []).join(' hoặc ')}.` };
  }
  const properties = feature.properties;
  const unknown = Object.keys(properties).find((key) => !allowedProperties.has(key));
  if (unknown) return { error: `thuộc tính "${unknown.slice(0, 40)}" không có trong khuôn (đưa vào attrs).` };
  const text = (key: string): string => {
    const value = properties[key];
    return typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value);
  };
  const attrsValue = properties.attrs;
  const attrsText = attrsValue === undefined || attrsValue === null ? '' : JSON.stringify(attrsValue);
  const common = readCommon(text('feature_key'), text('category'), text('name'), text('is_planned'), attrsText);
  if (common.error || !common.value) return { error: common.error ?? 'thuộc tính không hợp lệ.' };

  let roadClass: string | null = null;
  let widthM: number | null = null;
  let code: string | null = null;
  let validFrom: string | null = null;
  let validTo: string | null = null;
  if (geometryKind === 'line') {
    roadClass = text('road_class') || null;
    if (roadClass && !ROAD_CLASSES.includes(roadClass)) return { error: `road_class phải là ${ROAD_CLASSES.join(', ')}.` };
    const width = properties.width_m;
    if (width !== undefined && width !== null) {
      if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0 || width > 500) return { error: 'width_m phải là số dương (m).' };
      widthM = width;
    }
  } else {
    code = text('code') || null;
    if (code && code.length > CODE_MAX) return { error: `code dài quá ${CODE_MAX} ký tự.` };
    validFrom = text('valid_from') || null;
    validTo = text('valid_to') || null;
    if ((validFrom && !PACKAGE_PATTERNS.date.test(validFrom)) || (validTo && !PACKAGE_PATTERNS.date.test(validTo))) {
      return { error: 'valid_from/valid_to phải có dạng YYYY-MM-DD.' };
    }
  }
  return { row: { ...common.value, geometry: JSON.stringify(feature.geometry), roadClass, widthM, code, validFrom, validTo } };
}

async function insertLines(runner: QueryRunner, jobId: string, rows: readonly FeatureRow[], srid: number): Promise<number> {
  await runner.query(
    `INSERT INTO geo_staging.line_rows (job_id, line_no, feature_key, category, road_class, width_m, name, is_planned, attrs, geom)
     SELECT $1, t.line_no, t.feature_key, t.category, t.road_class, t.width_m, t.name, t.is_planned, t.attrs::jsonb,
            ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(t.geometry), $2), 4326)
     FROM unnest($3::int[], $4::text[], $5::text[], $6::text[], $7::real[], $8::text[], $9::boolean[], $10::text[], $11::text[])
       AS t(line_no, feature_key, category, road_class, width_m, name, is_planned, attrs, geometry)`,
    [
      jobId,
      srid,
      rows.map((row) => row.lineNo),
      rows.map((row) => row.featureKey),
      rows.map((row) => row.category),
      rows.map((row) => row.roadClass),
      rows.map((row) => row.widthM),
      rows.map((row) => row.name),
      rows.map((row) => row.isPlanned),
      rows.map((row) => row.attrs),
      rows.map((row) => row.geometry),
    ],
  );
  return rows.length;
}

async function insertAreas(runner: QueryRunner, jobId: string, rows: readonly FeatureRow[], srid: number): Promise<number> {
  await runner.query(
    `INSERT INTO geo_staging.area_rows (job_id, line_no, feature_key, category, code, name, valid_from, valid_to, attrs, geom)
     SELECT $1, t.line_no, t.feature_key, t.category, t.code, t.name, t.valid_from::date, t.valid_to::date, t.attrs::jsonb,
            ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(t.geometry), $2), 4326)
     FROM unnest($3::int[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::text[])
       AS t(line_no, feature_key, category, code, name, valid_from, valid_to, attrs, geometry)`,
    [
      jobId,
      srid,
      rows.map((row) => row.lineNo),
      rows.map((row) => row.featureKey),
      rows.map((row) => row.category),
      rows.map((row) => row.code),
      rows.map((row) => row.name),
      rows.map((row) => row.validFrom),
      rows.map((row) => row.validTo),
      rows.map((row) => row.attrs),
      rows.map((row) => row.geometry),
    ],
  );
  return rows.length;
}

// ───────────────────────────── chung ─────────────────────────────

interface CommonFields {
  featureKey: string;
  category: string;
  name: string;
  isPlanned: boolean;
  attrs: string;
}

/** Kiểm các cột chung của khuôn đối tượng. `attrs` trả về chuỗi JSON object đã chuẩn hóa. */
export function readCommon(
  featureKey: string,
  category: string,
  name: string,
  isPlanned: string,
  attrs: string,
): { value: CommonFields | null; error: string | null } {
  if (!PACKAGE_PATTERNS.featureKey.test(featureKey)) return { value: null, error: 'feature_key trống, quá 120 ký tự hoặc có ký tự lạ.' };
  if (!PACKAGE_PATTERNS.category.test(category)) return { value: null, error: 'category phải là chữ thường, số, gạch dưới (2–30 ký tự).' };
  if (name.length > NAME_MAX) return { value: null, error: `name dài quá ${NAME_MAX} ký tự.` };
  const planned = isPlanned.toLowerCase();
  if (!['', 'true', 'false'].includes(planned)) return { value: null, error: 'is_planned phải là true hoặc false.' };
  let attrsJson = '{}';
  if (attrs !== '') {
    if (Buffer.byteLength(attrs, 'utf8') > PACKAGE_LIMITS.attrsMaxBytes) return { value: null, error: `attrs lớn quá ${PACKAGE_LIMITS.attrsMaxBytes} byte.` };
    let parsed: unknown;
    try {
      parsed = JSON.parse(attrs);
    } catch {
      return { value: null, error: 'attrs không phải JSON hợp lệ.' };
    }
    if (!isRecord(parsed)) return { value: null, error: 'attrs phải là một object JSON.' };
    attrsJson = JSON.stringify(parsed);
  }
  return { value: { featureKey, category, name, isPlanned: planned === 'true', attrs: attrsJson }, error: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
