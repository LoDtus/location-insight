import type { QueryRunner } from 'typeorm';
import type { DiffSummary, QualityCheck } from './datasets.types.js';
import type { LoadResult } from './package-loader.js';
import { PACKAGE_BBOX, ROW_COUNT_DELTA, type GeometryKind, type PackageManifest } from './package-contracts.js';

/**
 * Kiểm tra mức gói và mức lớp trên vùng tạm (data-change-playbook.md, mục Kiểm tra mặc định). Tên bảng chọn từ
 * danh sách cố định theo dạng hình học, không lấy từ dữ liệu người gửi (threat model T10).
 */

const STAGING_TABLE: Record<GeometryKind, string> = {
  point: 'geo_staging.point_rows',
  line: 'geo_staging.line_rows',
  area: 'geo_staging.area_rows',
  grid: 'geo_staging.grid_rows',
};

const FEATURE_TABLE: Record<GeometryKind, string> = {
  point: 'geo.point_features',
  line: 'geo.line_features',
  area: 'geo.area_features',
  grid: 'geo.grid_values',
};

export function stagingTable(kind: GeometryKind): string {
  return STAGING_TABLE[kind];
}

export function featureTable(kind: GeometryKind): string {
  return FEATURE_TABLE[kind];
}

export interface BaseVersion {
  id: string;
  rowCount: number | null;
}

export interface CheckInput {
  jobId: string;
  geometryKind: GeometryKind;
  manifest: PackageManifest;
  load: LoadResult;
  dataSha256: string;
  base: BaseVersion | null;
}

export interface CheckOutput {
  checks: QualityCheck[];
  diffSummary: DiffSummary;
  preview: Array<Record<string, unknown>>;
}

function check(code: string, severity: QualityCheck['severity'], isPass: boolean, expected: string, observed: string): QualityCheck {
  return { code, severity, status: isPass ? 'pass' : 'fail', expected, observed };
}

export async function runChecks(runner: QueryRunner, input: CheckInput): Promise<CheckOutput> {
  const { jobId, geometryKind, manifest, load, base } = input;
  const table = STAGING_TABLE[geometryKind];
  const checks: QualityCheck[] = [];

  checks.push(check('data_checksum', 'blocking', input.dataSha256 === manifest.dataSha256, manifest.dataSha256, input.dataSha256));
  const contractProblem = load.headerError ?? (load.rowErrorCount > 0 ? `${load.rowErrorCount} dòng sai khuôn. ${load.rowErrors.join(' | ')}` : null);
  checks.push(check('contract_columns', 'blocking', contractProblem === null, 'đủ cột, đúng kiểu', contractProblem ?? 'đạt'));
  checks.push(check('row_count_match', 'blocking', load.totalRows === manifest.rowCount, `${manifest.rowCount} dòng`, `${load.totalRows} dòng`));
  checks.push(check('rows_present', 'blocking', load.loadedRows > 0, 'ít nhất 1 dòng hợp lệ', `${load.loadedRows} dòng`));
  checks.push(check('pipeline_dirty', 'warning', !manifest.pipeline.dirty, 'gói dựng từ code đã commit', manifest.pipeline.dirty ? 'có thay đổi chưa commit' : 'đạt'));

  const categories = geometryKind === 'grid' ? {} : await categoryCounts(runner, table, jobId);
  if (geometryKind !== 'grid' && Object.keys(manifest.categories).length > 0) {
    const mismatch = Object.keys({ ...manifest.categories, ...categories }).filter(
      (key) => (manifest.categories[key] ?? 0) !== (categories[key] ?? 0),
    );
    checks.push(check('category_count_match', 'blocking', mismatch.length === 0, 'khớp categories trong manifest', mismatch.length ? `lệch: ${mismatch.slice(0, 10).join(', ')}` : 'đạt'));
  }

  checks.push(...(await geometryChecks(runner, geometryKind, table, jobId, manifest)));
  if (geometryKind !== 'area' && geometryKind !== 'grid') {
    const rows = (await runner.query(
      `SELECT count(*)::int AS n FROM (SELECT feature_key FROM ${table} WHERE job_id = $1 GROUP BY feature_key HAVING count(*) > 1) d`,
      [jobId],
    )) as Array<{ n: number }>;
    const duplicates = rows[0]?.n ?? 0;
    checks.push(check('duplicate_key', 'blocking', duplicates === 0, 'feature_key không trùng', duplicates ? `${duplicates} khóa trùng` : 'đạt'));
  }

  const diffSummary = await buildDiff(runner, geometryKind, jobId, load.loadedRows, categories, base);
  checks.push(...rowCountDeltaChecks(diffSummary));
  checks.push(...(await coverageCheck(runner, jobId, base)));

  return { checks, diffSummary, preview: await preview(runner, geometryKind, jobId) };
}

async function categoryCounts(runner: QueryRunner, table: string, jobId: string): Promise<Record<string, number>> {
  const rows = (await runner.query(`SELECT category, count(*)::int AS n FROM ${table} WHERE job_id = $1 GROUP BY category`, [jobId])) as Array<{
    category: string;
    n: number;
  }>;
  return Object.fromEntries(rows.map((row) => [row.category, row.n]));
}

async function geometryChecks(
  runner: QueryRunner,
  kind: GeometryKind,
  table: string,
  jobId: string,
  manifest: PackageManifest,
): Promise<QualityCheck[]> {
  if (kind === 'grid') {
    const grids = (await runner.query('SELECT columns, rows FROM geo.grids WHERE code = $1', [manifest.gridCode])) as Array<{ columns: number; rows: number }>;
    const grid = grids[0];
    if (!grid) return [check('grid_known', 'blocking', false, 'gridCode có trong geo.grids', String(manifest.gridCode))];
    const rows = (await runner.query(
      `SELECT count(*) FILTER (WHERE cell_id < 0 OR cell_id >= $2::bigint)::int AS outside,
              count(*) FILTER (WHERE value IS NULL)::int AS empty
       FROM ${table} WHERE job_id = $1`,
      [jobId, grid.columns * grid.rows],
    )) as Array<{ outside: number; empty: number }>;
    const outside = rows[0]?.outside ?? 0;
    const duplicate = (await runner.query(
      `SELECT count(*)::int AS n FROM (SELECT cell_id FROM ${table} WHERE job_id = $1 GROUP BY cell_id HAVING count(*) > 1) d`,
      [jobId],
    )) as Array<{ n: number }>;
    return [
      check('grid_known', 'blocking', true, 'gridCode có trong geo.grids', String(manifest.gridCode)),
      check('inside_grid', 'blocking', outside === 0, `cell_id trong [0, ${grid.columns * grid.rows})`, outside ? `${outside} ô ngoài lưới` : 'đạt'),
      check('duplicate_key', 'blocking', (duplicate[0]?.n ?? 0) === 0, 'cell_id không trùng', duplicate[0]?.n ? `${duplicate[0].n} ô trùng` : 'đạt'),
    ];
  }
  const validity =
    kind === 'area'
      ? 'ST_IsEmpty(ST_CollectionExtract(ST_MakeValid(geom), 3))'
      : 'NOT ST_IsValid(geom) OR ST_IsEmpty(geom)';
  const rows = (await runner.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE ${validity})::int AS invalid,
            count(*) FILTER (WHERE ST_Intersects(geom, ST_MakeEnvelope($2, $3, $4, $5, 4326)))::int AS inside
     FROM ${table} WHERE job_id = $1`,
    [jobId, PACKAGE_BBOX.minLng, PACKAGE_BBOX.minLat, PACKAGE_BBOX.maxLng, PACKAGE_BBOX.maxLat],
  )) as Array<{ total: number; invalid: number; inside: number }>;
  const stats = rows[0] ?? { total: 0, invalid: 0, inside: 0 };
  const ratio = stats.total ? stats.inside / stats.total : 1;
  return [
    check('geometry_valid', 'blocking', stats.invalid === 0, 'hình học hợp lệ, không rỗng', stats.invalid ? `${stats.invalid} đối tượng lỗi` : 'đạt'),
    check(
      'inside_bbox',
      'blocking',
      ratio >= PACKAGE_BBOX.insideRatioMin,
      `≥ ${PACKAGE_BBOX.insideRatioMin * 100}% trong hộp Hà Nội`,
      `${(ratio * 100).toFixed(2)}%`,
    ),
  ];
}

async function buildDiff(
  runner: QueryRunner,
  kind: GeometryKind,
  jobId: string,
  rowCount: number,
  categories: Record<string, number>,
  base: BaseVersion | null,
): Promise<DiffSummary> {
  const summary: DiffSummary = {
    baseLayerVersionId: base?.id ?? null,
    baseRowCount: base?.rowCount ?? null,
    rowCount,
    added: null,
    removed: null,
    byCategory: {},
  };
  if (!base) {
    summary.byCategory = Object.fromEntries(Object.entries(categories).map(([key, after]) => [key, { before: 0, after }]));
    return summary;
  }
  if (kind === 'grid') return summary;
  const staging = STAGING_TABLE[kind];
  const target = FEATURE_TABLE[kind];
  const beforeRows = (await runner.query(
    `SELECT category, count(DISTINCT feature_key)::int AS n FROM ${target} WHERE layer_version_id = $1 GROUP BY category`,
    [base.id],
  )) as Array<{ category: string; n: number }>;
  const before = Object.fromEntries(beforeRows.map((row) => [row.category, row.n]));
  summary.byCategory = Object.fromEntries(
    [...new Set([...Object.keys(before), ...Object.keys(categories)])].map((key) => [key, { before: before[key] ?? 0, after: categories[key] ?? 0 }]),
  );
  const keyRows = (await runner.query(
    `SELECT
       (SELECT count(DISTINCT s.feature_key) FROM ${staging} s WHERE s.job_id = $1
          AND NOT EXISTS (SELECT 1 FROM ${target} f WHERE f.layer_version_id = $2 AND f.feature_key = s.feature_key))::int AS added,
       (SELECT count(DISTINCT f.feature_key) FROM ${target} f WHERE f.layer_version_id = $2
          AND NOT EXISTS (SELECT 1 FROM ${staging} s WHERE s.job_id = $1 AND s.feature_key = f.feature_key))::int AS removed`,
    [jobId, base.id],
  )) as Array<{ added: number; removed: number }>;
  summary.added = keyRows[0]?.added ?? null;
  summary.removed = keyRows[0]?.removed ?? null;
  return summary;
}

/** Lệch số dòng so với phiên bản đang phát hành: ±20% chặn, ±5% cảnh báo (cả từng category). */
export function rowCountDeltaChecks(diff: DiffSummary): QualityCheck[] {
  if (diff.baseRowCount === null || diff.baseRowCount === 0) {
    return [check('row_count_delta', 'warning', true, 'so với bản đang phát hành', 'chưa có bản để so')];
  }
  const delta = (current: number, previous: number): number => Math.abs(current - previous) / Math.max(previous, 1);
  const overall = delta(diff.rowCount, diff.baseRowCount);
  const categoryDeltas = Object.entries(diff.byCategory).map(([key, value]) => ({ key, value: delta(value.after, value.before), before: value.before }));
  const blocking = overall > ROW_COUNT_DELTA.rowCountDeltaBlock || categoryDeltas.some((item) => item.before >= 20 && item.value > ROW_COUNT_DELTA.rowCountDeltaBlock);
  const warning = overall > ROW_COUNT_DELTA.rowCountDeltaWarn || categoryDeltas.some((item) => item.before >= 20 && item.value > ROW_COUNT_DELTA.rowCountDeltaWarn);
  const observed = `tổng ${(overall * 100).toFixed(1)}% (${diff.baseRowCount} → ${diff.rowCount})`;
  return [
    check('row_count_delta', 'blocking', !blocking, `lệch ≤ ${ROW_COUNT_DELTA.rowCountDeltaBlock * 100}%`, observed),
    check('row_count_delta_warn', 'warning', !warning, `lệch ≤ ${ROW_COUNT_DELTA.rowCountDeltaWarn * 100}%`, observed),
  ];
}

async function coverageCheck(runner: QueryRunner, jobId: string, base: BaseVersion | null): Promise<QualityCheck[]> {
  if (!base) return [];
  const rows = (await runner.query(
    `SELECT ST_Area(c.geom::geography) AS after, ST_Area(v.coverage::geography) AS before
     FROM geo_staging.coverages c, geo.layer_versions v WHERE c.job_id = $1 AND v.id = $2`,
    [jobId, base.id],
  )) as Array<{ after: number | null; before: number | null }>;
  const row = rows[0];
  if (!row || row.after === null || row.before === null) return [];
  const isShrunk = row.after < row.before * 0.999;
  return [check('coverage_change', 'warning', !isShrunk, 'vùng phủ không nhỏ hơn bản trước', `${Math.round(row.before / 1e6)} → ${Math.round(row.after / 1e6)} km²`)];
}

async function preview(runner: QueryRunner, kind: GeometryKind, jobId: string): Promise<Array<Record<string, unknown>>> {
  const table = STAGING_TABLE[kind];
  if (kind === 'grid') {
    return (await runner.query(`SELECT line_no AS "lineNo", cell_id AS "cellId", value FROM ${table} WHERE job_id = $1 ORDER BY line_no LIMIT 20`, [
      jobId,
    ])) as Array<Record<string, unknown>>;
  }
  const extra =
    kind === 'point'
      ? `kind, round(ST_Y(geom)::numeric, 6) AS lat, round(ST_X(geom)::numeric, 6) AS lng`
      : kind === 'line'
        ? `road_class AS "roadClass", width_m AS "widthM", round(ST_Length(geom::geography)) AS "lengthM"`
        : `code, round(ST_Area(geom::geography)) AS "areaM2"`;
  return (await runner.query(
    `SELECT line_no AS "lineNo", feature_key AS "featureKey", category, name, ${extra}, attrs
     FROM ${table} WHERE job_id = $1 ORDER BY line_no LIMIT 20`,
    [jobId],
  )) as Array<Record<string, unknown>>;
}

/** Băm nội dung phiên bản lớp (phát hiện ghi ngoài đường nhập, threat model T13). */
export function contentHashSql(kind: GeometryKind): string {
  const table = FEATURE_TABLE[kind];
  const row =
    kind === 'grid'
      ? `cell_id::text || '|' || coalesce(value::text, '')`
      : kind === 'point'
        ? `feature_key || '|' || category || '|' || kind || '|' || name || '|' || is_planned::text || '|' || attrs::text || '|' || encode(ST_AsEWKB(geom::geometry), 'hex')`
        : kind === 'line'
          ? `feature_key || '|' || category || '|' || coalesce(road_class, '') || '|' || coalesce(width_m::text, '') || '|' || name || '|' || is_planned::text || '|' || attrs::text || '|' || encode(ST_AsEWKB(geom::geometry), 'hex')`
          : `feature_key || '|' || category || '|' || coalesce(code, '') || '|' || name || '|' || coalesce(valid_from::text, '') || '|' || coalesce(valid_to::text, '') || '|' || attrs::text || '|' || encode(ST_AsEWKB(geom), 'hex')`;
  return `SELECT encode(sha256(convert_to(coalesce(string_agg(h, '' ORDER BY h), ''), 'UTF8')), 'hex') AS hash
          FROM (SELECT md5(${row}) AS h FROM ${table} WHERE layer_version_id = $1) rows`;
}
