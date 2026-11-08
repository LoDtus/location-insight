/**
 * Migration SQL của schema `geo` và `geo_staging` (018-location-data, research.md Bản ghi 8 và 12).
 * Không dùng entity TypeORM: `synchronize` không hiểu kiểu PostGIS, và `/reset` chỉ dọn `public` nên dữ liệu nền
 * còn nguyên sau reset. Chỉ thêm migration mới ở cuối, không sửa migration đã chạy.
 *
 * Bảo vệ "một đường ghi" bằng trigger: mọi lệnh ghi vào bảng đối tượng phải đặt
 * `SET LOCAL geo.write_mode = 'ingest' | 'purge'` trong transaction. Chỉ module datasets được làm việc này
 * (test kiến trúc `geo-write-boundary.spec.ts`). Superuser vẫn vượt được; content_hash dùng để phát hiện.
 */
export interface GeoMigration {
  id: string;
  sql: string;
}

const GUARD_FUNCTIONS = `
CREATE OR REPLACE FUNCTION geo.write_mode() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('geo.write_mode', true), '') $$;

CREATE OR REPLACE FUNCTION geo.guard_feature_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  version_status text;
BEGIN
  IF geo.write_mode() <> 'ingest' THEN
    RAISE EXCEPTION 'geo: chỉ được ghi đối tượng qua đường nhập gói (geo.write_mode = ingest)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT status INTO version_status FROM geo.layer_versions WHERE id = NEW.layer_version_id;
  IF version_status IS DISTINCT FROM 'building' THEN
    RAISE EXCEPTION 'geo: phiên bản lớp % không ở trạng thái building', NEW.layer_version_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION geo.guard_feature_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND geo.write_mode() = 'purge' THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'geo: không sửa hay xóa đối tượng đã nhập (% trên %)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE OR REPLACE FUNCTION geo.guard_layer_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'geo: không xóa phiên bản lớp, chỉ chuyển retired' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF geo.write_mode() <> 'ingest' OR NEW.status <> 'building' THEN
      RAISE EXCEPTION 'geo: phiên bản lớp chỉ được tạo bởi đường nhập, ở trạng thái building'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id OR NEW.layer_code <> OLD.layer_code OR NEW.label <> OLD.label
     OR NEW.import_job_id <> OLD.import_job_id OR NEW.package_sha256 <> OLD.package_sha256
     OR NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'geo: không sửa định danh hay nguồn gốc của phiên bản lớp' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.status = 'building' THEN
    IF geo.write_mode() <> 'ingest' THEN
      RAISE EXCEPTION 'geo: chỉ đường nhập được hoàn tất phiên bản building' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'ready' THEN
    IF NEW.content_hash IS DISTINCT FROM OLD.content_hash OR NEW.row_count IS DISTINCT FROM OLD.row_count
       OR NEW.checks IS DISTINCT FROM OLD.checks OR NEW.diff_summary IS DISTINCT FROM OLD.diff_summary
       OR NEW.coverage IS DISTINCT FROM OLD.coverage OR NEW.accepted_warnings IS DISTINCT FROM OLD.accepted_warnings
       OR NEW.ready_at IS DISTINCT FROM OLD.ready_at THEN
      RAISE EXCEPTION 'geo: phiên bản ready không sửa được' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.status NOT IN ('ready', 'retired') THEN
      RAISE EXCEPTION 'geo: ready chỉ được chuyển sang retired' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- retired: chỉ khôi phục từ gói (về building) qua đường nhập.
  IF NEW.status = 'retired' OR (NEW.status = 'building' AND geo.write_mode() = 'ingest') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'geo: phiên bản retired chỉ khôi phục được từ gói' USING ERRCODE = 'insufficient_privilege';
END $$;
`;

const FEATURE_TRIGGERS = ['point_features', 'line_features', 'area_features', 'grid_values']
  .map(
    (table) => `
DROP TRIGGER IF EXISTS trg_${table}_guard_insert ON geo.${table};
CREATE TRIGGER trg_${table}_guard_insert BEFORE INSERT ON geo.${table}
  FOR EACH ROW EXECUTE FUNCTION geo.guard_feature_insert();
DROP TRIGGER IF EXISTS trg_${table}_guard_change ON geo.${table};
CREATE TRIGGER trg_${table}_guard_change BEFORE UPDATE OR DELETE ON geo.${table}
  FOR EACH STATEMENT EXECUTE FUNCTION geo.guard_feature_change();
DROP TRIGGER IF EXISTS trg_${table}_guard_truncate ON geo.${table};
CREATE TRIGGER trg_${table}_guard_truncate BEFORE TRUNCATE ON geo.${table}
  FOR EACH STATEMENT EXECUTE FUNCTION geo.guard_feature_change();`,
  )
  .join('\n');

export const GEO_MIGRATIONS: readonly GeoMigration[] = [
  {
    id: '001_geo_schema',
    sql: `
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS geo_staging;

CREATE TABLE IF NOT EXISTS geo.layers (
  code varchar(60) PRIMARY KEY,
  geometry_kind varchar(10) NOT NULL,
  contract varchar(12) NOT NULL,
  source_code varchar(40) NOT NULL,
  usage varchar(10) NOT NULL DEFAULT 'public',
  attribution varchar(300) NOT NULL DEFAULT '',
  description varchar(300) NOT NULL DEFAULT '',
  usage_reason varchar(500),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_layers_geometry_kind CHECK (geometry_kind IN ('point', 'line', 'area', 'grid')),
  CONSTRAINT ck_layers_usage CHECK (usage IN ('public', 'internal', 'blocked')),
  CONSTRAINT ck_layers_contract CHECK (split_part(contract, '@', 1) = geometry_kind)
);

CREATE TABLE IF NOT EXISTS geo.import_jobs (
  id uuid PRIMARY KEY,
  layer_code varchar(60) NOT NULL,
  label varchar(40) NOT NULL,
  contract varchar(12) NOT NULL,
  purpose varchar(10) NOT NULL DEFAULT 'new',
  status varchar(12) NOT NULL DEFAULT 'uploaded',
  package_key varchar(300) NOT NULL,
  package_sha256 varchar(64) NOT NULL,
  size_bytes bigint NOT NULL,
  manifest jsonb NOT NULL,
  checks jsonb NOT NULL DEFAULT '[]',
  diff_summary jsonb,
  preview jsonb,
  row_count integer,
  error varchar(1000),
  uploaded_by uuid NOT NULL,
  decided_by uuid,
  accepted_warnings varchar(500),
  layer_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT fk_import_jobs_layers FOREIGN KEY (layer_code) REFERENCES geo.layers (code),
  CONSTRAINT ck_import_jobs_purpose CHECK (purpose IN ('new', 'restore')),
  CONSTRAINT ck_import_jobs_status CHECK (status IN ('uploaded', 'validating', 'validated', 'rejected', 'saving', 'saved', 'discarded', 'failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_import_jobs_package_sha256 ON geo.import_jobs (package_sha256)
  WHERE purpose = 'new' AND status NOT IN ('rejected', 'discarded', 'failed');
CREATE UNIQUE INDEX IF NOT EXISTS uk_import_jobs_layer_code_label ON geo.import_jobs (layer_code, label)
  WHERE purpose = 'new' AND status NOT IN ('rejected', 'discarded', 'failed');
CREATE INDEX IF NOT EXISTS idx_import_jobs_status_created_at ON geo.import_jobs (status, created_at);

CREATE TABLE IF NOT EXISTS geo.layer_versions (
  id uuid PRIMARY KEY,
  layer_code varchar(60) NOT NULL,
  label varchar(40) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'building',
  import_job_id uuid NOT NULL,
  package_sha256 varchar(64) NOT NULL,
  manifest jsonb NOT NULL,
  content_hash varchar(64),
  integrity_checked_at timestamptz,
  integrity_ok boolean,
  row_count integer,
  coverage geometry(MultiPolygon, 4326),
  checks jsonb NOT NULL DEFAULT '[]',
  diff_summary jsonb,
  accepted_warnings varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  retired_at timestamptz,
  CONSTRAINT fk_layer_versions_layers FOREIGN KEY (layer_code) REFERENCES geo.layers (code),
  CONSTRAINT fk_layer_versions_import_jobs FOREIGN KEY (import_job_id) REFERENCES geo.import_jobs (id),
  CONSTRAINT uk_layer_versions_layer_code_label UNIQUE (layer_code, label),
  CONSTRAINT uk_layer_versions_package_sha256 UNIQUE (package_sha256),
  CONSTRAINT ck_layer_versions_status CHECK (status IN ('building', 'ready', 'retired'))
);
CREATE INDEX IF NOT EXISTS idx_layer_versions_status ON geo.layer_versions (status);

CREATE TABLE IF NOT EXISTS geo.point_features (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layer_version_id uuid NOT NULL,
  feature_key varchar(120) NOT NULL,
  category varchar(30) NOT NULL,
  kind varchar(30) NOT NULL DEFAULT '',
  name varchar(200) NOT NULL DEFAULT '',
  is_planned boolean NOT NULL DEFAULT false,
  attrs jsonb NOT NULL DEFAULT '{}',
  geom geography(Point, 4326) NOT NULL,
  CONSTRAINT fk_point_features_layer_versions FOREIGN KEY (layer_version_id) REFERENCES geo.layer_versions (id),
  CONSTRAINT uk_point_features_layer_version_id_feature_key UNIQUE (layer_version_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_point_features_layer_version_id_category ON geo.point_features (layer_version_id, category);
CREATE INDEX IF NOT EXISTS idx_point_features_geom ON geo.point_features USING gist (geom);

CREATE TABLE IF NOT EXISTS geo.line_features (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layer_version_id uuid NOT NULL,
  feature_key varchar(120) NOT NULL,
  category varchar(30) NOT NULL,
  road_class varchar(20),
  width_m real,
  name varchar(200) NOT NULL DEFAULT '',
  is_planned boolean NOT NULL DEFAULT false,
  attrs jsonb NOT NULL DEFAULT '{}',
  geom geography(MultiLineString, 4326) NOT NULL,
  CONSTRAINT fk_line_features_layer_versions FOREIGN KEY (layer_version_id) REFERENCES geo.layer_versions (id),
  CONSTRAINT uk_line_features_layer_version_id_feature_key UNIQUE (layer_version_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_line_features_layer_version_id_category_road_class ON geo.line_features (layer_version_id, category, road_class);
CREATE INDEX IF NOT EXISTS idx_line_features_geom ON geo.line_features USING gist (geom);

CREATE TABLE IF NOT EXISTS geo.area_features (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layer_version_id uuid NOT NULL,
  feature_key varchar(120) NOT NULL,
  category varchar(30) NOT NULL,
  code varchar(30),
  name varchar(200) NOT NULL DEFAULT '',
  valid_from date,
  valid_to date,
  attrs jsonb NOT NULL DEFAULT '{}',
  geom geometry(MultiPolygon, 4326) NOT NULL,
  CONSTRAINT fk_area_features_layer_versions FOREIGN KEY (layer_version_id) REFERENCES geo.layer_versions (id)
);
CREATE INDEX IF NOT EXISTS idx_area_features_layer_version_id_feature_key ON geo.area_features (layer_version_id, feature_key);
CREATE INDEX IF NOT EXISTS idx_area_features_layer_version_id_category ON geo.area_features (layer_version_id, category);
CREATE INDEX IF NOT EXISTS idx_area_features_geom ON geo.area_features USING gist (geom);

CREATE TABLE IF NOT EXISTS geo.grids (
  code varchar(30) PRIMARY KEY,
  srid integer NOT NULL,
  cell_size_m integer NOT NULL,
  origin_x double precision NOT NULL,
  origin_y double precision NOT NULL,
  columns integer NOT NULL,
  rows integer NOT NULL
);
-- Lưới 100 m VN-2000 / UTM 48N phủ hộp Hà Nội mở rộng (package-contracts.json bbox). cell_id = hàng * columns + cột,
-- hàng tính từ origin_y đi lên.
INSERT INTO geo.grids (code, srid, cell_size_m, origin_x, origin_y, columns, rows)
VALUES ('vn2000-100m', 3405, 100, 523600, 2268000, 878, 1034)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS geo.grid_values (
  layer_version_id uuid NOT NULL,
  grid_code varchar(30) NOT NULL,
  cell_id bigint NOT NULL,
  value real,
  CONSTRAINT pk_grid_values PRIMARY KEY (layer_version_id, cell_id),
  CONSTRAINT fk_grid_values_layer_versions FOREIGN KEY (layer_version_id) REFERENCES geo.layer_versions (id),
  CONSTRAINT fk_grid_values_grids FOREIGN KEY (grid_code) REFERENCES geo.grids (code)
);

-- Vùng tạm: UNLOGGED, chỉ module datasets đọc ghi; đánh giá không bao giờ đọc schema này.
CREATE UNLOGGED TABLE IF NOT EXISTS geo_staging.point_rows (
  job_id uuid NOT NULL,
  line_no integer NOT NULL,
  feature_key varchar(120) NOT NULL,
  category varchar(30) NOT NULL,
  kind varchar(30) NOT NULL DEFAULT '',
  name varchar(200) NOT NULL DEFAULT '',
  is_planned boolean NOT NULL DEFAULT false,
  attrs jsonb NOT NULL DEFAULT '{}',
  geom geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_point_rows_job_id ON geo_staging.point_rows (job_id);

CREATE UNLOGGED TABLE IF NOT EXISTS geo_staging.line_rows (
  job_id uuid NOT NULL,
  line_no integer NOT NULL,
  feature_key varchar(120) NOT NULL,
  category varchar(30) NOT NULL,
  road_class varchar(20),
  width_m real,
  name varchar(200) NOT NULL DEFAULT '',
  is_planned boolean NOT NULL DEFAULT false,
  attrs jsonb NOT NULL DEFAULT '{}',
  geom geometry NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_line_rows_job_id ON geo_staging.line_rows (job_id);

CREATE UNLOGGED TABLE IF NOT EXISTS geo_staging.area_rows (
  job_id uuid NOT NULL,
  line_no integer NOT NULL,
  feature_key varchar(120) NOT NULL,
  category varchar(30) NOT NULL,
  code varchar(30),
  name varchar(200) NOT NULL DEFAULT '',
  valid_from date,
  valid_to date,
  attrs jsonb NOT NULL DEFAULT '{}',
  geom geometry NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_area_rows_job_id ON geo_staging.area_rows (job_id);

CREATE UNLOGGED TABLE IF NOT EXISTS geo_staging.grid_rows (
  job_id uuid NOT NULL,
  line_no integer NOT NULL,
  cell_id bigint NOT NULL,
  value real
);
CREATE INDEX IF NOT EXISTS idx_grid_rows_job_id ON geo_staging.grid_rows (job_id);

CREATE UNLOGGED TABLE IF NOT EXISTS geo_staging.coverages (
  job_id uuid PRIMARY KEY,
  geom geometry NOT NULL
);

${GUARD_FUNCTIONS}
${FEATURE_TRIGGERS}

DROP TRIGGER IF EXISTS trg_layer_versions_guard ON geo.layer_versions;
CREATE TRIGGER trg_layer_versions_guard BEFORE INSERT OR UPDATE OR DELETE ON geo.layer_versions
  FOR EACH ROW EXECUTE FUNCTION geo.guard_layer_version();
`,
  },
];
