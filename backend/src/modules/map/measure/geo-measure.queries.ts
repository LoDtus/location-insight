import type { DataSource } from 'typeorm';

/**
 * Câu đo trên PostGIS cho một tọa độ (research.md Bản ghi 10 và 15). Mỗi dạng hình học một câu, gộp mọi tiêu chí
 * bằng `jsonb_to_recordset` + `LATERAL`, nên một lượt đánh giá chỉ 3 lượt gọi database chạy song song:
 *
 * - **Điểm:** KNN `ORDER BY geom <-> điểm` có giới hạn `ST_DWithin` (dùng chỉ mục GiST, dừng sớm), lấy `take` điểm
 *   gần nhất; đếm trong bán kính có trừ hao tuyến tính theo khoảng cách. Đối tượng của nhiều nguồn cùng chủ đề được
 *   gộp trùng lúc đếm bằng ô 40 m trên VN-2000 (quy tắc gộp giữa nguồn, Bản ghi 8).
 * - **Đường:** khoảng cách tới đường gần nhất thuộc các cấp đường.
 * - **Lưới:** chuyển điểm sang hệ của lưới, sinh mã các ô trong bán kính bằng phép tính (không cần chỉ mục không
 *   gian), rồi tra `grid_values` theo khóa chính.
 *
 * Mọi câu chạy trong transaction READ ONLY với `statement_timeout` để một câu chậm không giữ kết nối.
 */

export const STATEMENT_TIMEOUT_MS = 2000;
/** Cỡ ô gộp trùng đối tượng giữa các nguồn khi đếm (mét). */
export const DEDUPE_CELL_M = 40;

export interface PointRequest {
  id: string;
  versions: string[];
  categories: string[];
  kinds: string[] | null;
  searchM: number;
  take: number;
  /** Bán kính đếm (độ tin hoặc tiêu chí đếm). */
  countM: number;
}

export interface PointRow {
  id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  total: number;
  weighted: number;
  versions: string[] | null;
}

export interface LineRequest {
  id: string;
  versions: string[];
  roadClasses: string[];
  searchM: number;
}

export interface LineRow {
  id: string;
  name: string | null;
  road_class: string | null;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  version: string | null;
}

export interface GridRequest {
  id: string;
  versions: string[];
  radiusM: number;
}

export interface GridRow {
  id: string;
  version: string;
  distance_m: number;
  value: number | null;
}

const POINT_SQL = `
WITH pt AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g),
req AS (
  SELECT * FROM jsonb_to_recordset($3::jsonb)
    AS r(id text, versions uuid[], categories text[], kinds text[], "searchM" float8, take int, "countM" float8)
)
SELECT r.id, n.name, n.lat, n.lng, n.distance_m, n.versions, coalesce(c.total, 0)::int AS total, coalesce(c.weighted, 0)::float8 AS weighted
FROM req r CROSS JOIN pt
LEFT JOIN LATERAL (
  SELECT f.name, ST_Y(f.geom::geometry) AS lat, ST_X(f.geom::geometry) AS lng, ST_Distance(f.geom, pt.g) AS distance_m,
         ARRAY[f.layer_version_id] AS versions
  FROM geo.point_features f
  WHERE f.layer_version_id = ANY (r.versions)
    AND f.category = ANY (r.categories)
    AND (r.kinds IS NULL OR f.kind = ANY (r.kinds))
    AND ST_DWithin(f.geom, pt.g, r."searchM")
  ORDER BY f.geom <-> pt.g
  LIMIT r.take
) n ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS total, sum(greatest(0, 1 - d.distance_m / r."countM")) AS weighted
  FROM (
    SELECT min(ST_Distance(f.geom, pt.g)) AS distance_m
    FROM geo.point_features f
    WHERE f.layer_version_id = ANY (r.versions)
      AND f.category = ANY (r.categories)
      AND (r.kinds IS NULL OR f.kind = ANY (r.kinds))
      AND ST_DWithin(f.geom, pt.g, r."countM")
    GROUP BY f.category, ST_SnapToGrid(ST_Transform(f.geom::geometry, 3405), ${DEDUPE_CELL_M})
  ) d
) c ON true
ORDER BY r.id, n.distance_m NULLS LAST`;

const LINE_SQL = `
WITH pt AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g),
req AS (SELECT * FROM jsonb_to_recordset($3::jsonb) AS r(id text, versions uuid[], "roadClasses" text[], "searchM" float8))
SELECT r.id, n.name, n.road_class, n.lat, n.lng, n.distance_m, n.version
FROM req r CROSS JOIN pt
LEFT JOIN LATERAL (
  SELECT f.name, f.road_class, f.layer_version_id::text AS version, ST_Distance(f.geom, pt.g) AS distance_m,
         ST_Y(ST_ClosestPoint(f.geom::geometry, pt.g::geometry)) AS lat, ST_X(ST_ClosestPoint(f.geom::geometry, pt.g::geometry)) AS lng
  FROM geo.line_features f
  WHERE f.layer_version_id = ANY (r.versions)
    AND f.road_class = ANY (r."roadClasses")
    AND ST_DWithin(f.geom, pt.g, r."searchM")
  ORDER BY f.geom <-> pt.g
  LIMIT 1
) n ON true`;

/**
 * cell_id = hàng × columns + cột, hàng tính từ origin_y đi lên (geo.grids). Khoảng cách ô tính giữa tâm ô chứa
 * điểm và tâm ô lân cận, đủ cho bán kính vài trăm mét trên ô 100 m.
 */
const GRID_SQL = `
WITH req AS (SELECT * FROM jsonb_to_recordset($3::jsonb) AS r(id text, versions uuid[], "radiusM" float8)),
lv AS (
  SELECT r.id, r."radiusM", v.id AS version, gr.*
  FROM req r
  CROSS JOIN LATERAL unnest(r.versions) AS u(version_id)
  JOIN geo.layer_versions v ON v.id = u.version_id
  JOIN geo.grids gr ON gr.code = v.manifest ->> 'gridCode'
),
cell AS (
  SELECT lv.*, floor((ST_X(p) - lv.origin_x) / lv.cell_size_m)::int AS col, floor((ST_Y(p) - lv.origin_y) / lv.cell_size_m)::int AS row_no,
         ceil(lv."radiusM" / lv.cell_size_m)::int AS reach
  FROM lv CROSS JOIN LATERAL ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), lv.srid) AS p
),
cand AS (
  SELECT cell.id, cell.version, (cell.row_no + dr)::bigint * cell.columns + (cell.col + dc) AS cell_id,
         sqrt((dr * dr + dc * dc)::float8) * cell.cell_size_m AS distance_m
  FROM cell
  CROSS JOIN LATERAL generate_series(-cell.reach, cell.reach) AS dr
  CROSS JOIN LATERAL generate_series(-cell.reach, cell.reach) AS dc
  WHERE cell.col + dc BETWEEN 0 AND cell.columns - 1
    AND cell.row_no + dr BETWEEN 0 AND cell.rows - 1
    AND sqrt((dr * dr + dc * dc)::float8) * cell.cell_size_m <= cell."radiusM"
)
SELECT cand.id, cand.version::text AS version, cand.distance_m, g.value
FROM cand
JOIN geo.grid_values g ON g.layer_version_id = cand.version AND g.cell_id = cand.cell_id`;

/** Số ô có tâm trong bán kính (để tính tỷ lệ phủ của lớp lưới). */
export function cellsWithin(radiusM: number, cellSizeM = 100): number {
  const reach = Math.ceil(radiusM / cellSizeM);
  let count = 0;
  for (let dr = -reach; dr <= reach; dr += 1) {
    for (let dc = -reach; dc <= reach; dc += 1) if (Math.sqrt(dr * dr + dc * dc) * cellSizeM <= radiusM) count += 1;
  }
  return count;
}

async function readOnly<T>(dataSource: DataSource, sql: string, params: unknown[]): Promise<T[]> {
  return dataSource.transaction(async (manager) => {
    // SET TRANSACTION phải đứng trước mọi câu khác trong transaction.
    await manager.query('SET TRANSACTION READ ONLY');
    await manager.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    return (await manager.query(sql, params)) as T[];
  });
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function queryPoints(dataSource: DataSource, lat: number, lng: number, requests: PointRequest[]): Promise<PointRow[]> {
  if (requests.length === 0) return [];
  const rows = await readOnly<PointRow>(dataSource, POINT_SQL, [lng, lat, JSON.stringify(requests)]);
  return rows.map((row) => ({
    ...row,
    lat: numeric(row.lat),
    lng: numeric(row.lng),
    distance_m: numeric(row.distance_m),
    total: numeric(row.total) ?? 0,
    weighted: numeric(row.weighted) ?? 0,
  }));
}

export async function queryLines(dataSource: DataSource, lat: number, lng: number, requests: LineRequest[]): Promise<LineRow[]> {
  if (requests.length === 0) return [];
  const rows = await readOnly<LineRow>(dataSource, LINE_SQL, [lng, lat, JSON.stringify(requests)]);
  return rows.map((row) => ({ ...row, lat: numeric(row.lat), lng: numeric(row.lng), distance_m: numeric(row.distance_m) }));
}

export async function queryGrids(dataSource: DataSource, lat: number, lng: number, requests: GridRequest[]): Promise<GridRow[]> {
  if (requests.length === 0) return [];
  const rows = await readOnly<GridRow>(dataSource, GRID_SQL, [lng, lat, JSON.stringify(requests)]);
  return rows.map((row) => ({ ...row, distance_m: numeric(row.distance_m) ?? 0, value: numeric(row.value) }));
}

export interface ReleaseLayer {
  versionId: string;
  layerCode: string;
  geometryKind: 'point' | 'line' | 'area' | 'grid';
}

/** Phiên bản lớp của bản phát hành còn dùng được: `ready` và lớp không bị chặn giấy phép. */
export async function queryReleaseLayers(dataSource: DataSource, versionIds: string[]): Promise<ReleaseLayer[]> {
  if (versionIds.length === 0) return [];
  const rows = (await dataSource.query(
    `SELECT v.id::text AS "versionId", v.layer_code AS "layerCode", l.geometry_kind AS "geometryKind"
     FROM geo.layer_versions v JOIN geo.layers l ON l.code = v.layer_code
     WHERE v.id = ANY ($1::uuid[]) AND v.status = 'ready' AND l.usage <> 'blocked'`,
    [versionIds],
  )) as ReleaseLayer[];
  return rows;
}
