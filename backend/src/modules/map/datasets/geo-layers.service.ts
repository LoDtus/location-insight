import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BusinessException } from '../../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../../shared/constants/error-code.constant.js';
import type { DiffSummary, LayerVersionStatus, LayerVersionView, LayerView, QualityCheck } from './datasets.types.js';
import { GeoSchemaService } from './geo-schema.service.js';
import { CONTRACTS, type ContractId, type GeometryKind, type LayerUsage, type PackageManifest } from './package-contracts.js';

interface LayerRow {
  code: string;
  geometry_kind: GeometryKind;
  contract: ContractId;
  source_code: string;
  usage: LayerUsage;
  attribution: string;
  description: string;
  usage_reason: string | null;
  created_at: Date;
}

interface LayerVersionRow {
  id: string;
  layer_code: string;
  label: string;
  status: LayerVersionStatus;
  row_count: number | null;
  package_sha256: string;
  integrity_ok: boolean | null;
  integrity_checked_at: Date | null;
  created_at: Date;
  ready_at: Date | null;
  retired_at: Date | null;
  diff_summary: DiffSummary | null;
  checks: QualityCheck[];
  accepted_warnings: string | null;
  manifest: PackageManifest;
}

/** Thông tin tối thiểu về một phiên bản lớp, dùng khi dựng và kiểm bản phát hành. */
export interface LayerVersionRef {
  id: string;
  layerCode: string;
  label: string;
  status: LayerVersionStatus;
  integrityOk: boolean | null;
  usage: LayerUsage;
  rowCount: number | null;
  checks: QualityCheck[];
  diffSummary: DiffSummary | null;
}

export interface CreateLayerInput {
  code: string;
  contract: ContractId;
  sourceCode: string;
  usage: Exclude<LayerUsage, 'blocked'>;
  attribution: string;
  description: string;
}

export interface UpdateLayerInput {
  usage?: LayerUsage;
  attribution?: string;
  description?: string;
  reason?: string;
}

const VERSION_COLUMNS = `v.id, v.layer_code, v.label, v.status, v.row_count, v.package_sha256, v.integrity_ok,
  v.integrity_checked_at, v.created_at, v.ready_at, v.retired_at, v.diff_summary, v.checks, v.accepted_warnings, v.manifest`;

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Lớp dữ liệu nền và phiên bản lớp (chỉ đọc phiên bản; phiên bản chỉ sinh ra từ đường nhập gói). */
@Injectable()
export class GeoLayersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly geoSchema: GeoSchemaService,
  ) {}

  async list(): Promise<LayerView[]> {
    await this.geoSchema.assertReady();
    const layers = (await this.dataSource.query(
      `SELECT code, geometry_kind, contract, source_code, usage, attribution, description, usage_reason, created_at
       FROM geo.layers ORDER BY code`,
    )) as LayerRow[];
    const versions = (await this.dataSource.query(
      `SELECT ${VERSION_COLUMNS} FROM geo.layer_versions v ORDER BY v.layer_code, v.created_at DESC`,
    )) as LayerVersionRow[];
    const releases = await this.releaseMembership();
    return layers.map((layer) => ({
      code: layer.code,
      geometryKind: layer.geometry_kind,
      contract: layer.contract,
      sourceCode: layer.source_code,
      usage: layer.usage,
      attribution: layer.attribution,
      description: layer.description,
      usageReason: layer.usage_reason,
      createdAt: layer.created_at.toISOString(),
      versions: versions.filter((row) => row.layer_code === layer.code).map((row) => this.toVersionView(row, releases)),
    }));
  }

  async create(adminId: string, input: CreateLayerInput): Promise<LayerView> {
    await this.geoSchema.assertReady();
    const geometryKind = CONTRACTS[input.contract].geometryKind;
    const sourcePrefix = input.code.split('.')[0];
    if (sourcePrefix !== input.sourceCode) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Mã lớp phải bắt đầu bằng mã nguồn (nguồn.chủ_đề).', { code: 'LAYER_SOURCE_MISMATCH' });
    }
    const inserted = (await this.dataSource.query(
      `INSERT INTO geo.layers (code, geometry_kind, contract, source_code, usage, attribution, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (code) DO NOTHING RETURNING code`,
      [input.code, geometryKind, input.contract, input.sourceCode, input.usage, input.attribution, input.description, adminId],
    )) as Array<{ code: string }>;
    if (inserted.length === 0) {
      throw new BusinessException(ErrorCode.CONFLICT, 'Đã có lớp với mã này.', { code: 'LAYER_EXISTS' }, HttpStatus.CONFLICT);
    }
    return this.getView(input.code);
  }

  /** Chỉ sửa được cách dùng, câu ghi nguồn và mô tả. Đổi `usage` phải kèm lý do (nhật ký). */
  async update(code: string, input: UpdateLayerInput): Promise<LayerView> {
    await this.geoSchema.assertReady();
    const layer = await this.findLayer(code);
    const isUsageChange = input.usage !== undefined && input.usage !== layer.usage;
    if (isUsageChange && !input.reason) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Đổi cách dùng của lớp cần ghi lý do.', { code: 'REASON_REQUIRED' });
    }
    await this.dataSource.query(
      `UPDATE geo.layers SET
         usage = COALESCE($2, usage),
         attribution = COALESCE($3, attribution),
         description = COALESCE($4, description),
         usage_reason = CASE WHEN $5::boolean THEN $6 ELSE usage_reason END,
         updated_at = now()
       WHERE code = $1`,
      [code, input.usage ?? null, input.attribution ?? null, input.description ?? null, isUsageChange, input.reason ?? null],
    );
    return this.getView(code);
  }

  async findLayer(code: string): Promise<LayerRow> {
    const rows = (await this.dataSource.query(
      `SELECT code, geometry_kind, contract, source_code, usage, attribution, description, usage_reason, created_at
       FROM geo.layers WHERE code = $1`,
      [code],
    )) as LayerRow[];
    if (!rows[0]) throw new BusinessException(ErrorCode.NOT_FOUND, 'Không có lớp này.', { code: 'LAYER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return rows[0];
  }

  async findVersions(ids: readonly string[]): Promise<LayerVersionRef[]> {
    if (ids.length === 0) return [];
    const rows = (await this.dataSource.query(
      `SELECT v.id, v.layer_code, v.label, v.status, v.integrity_ok, v.row_count, v.checks, v.diff_summary, l.usage
       FROM geo.layer_versions v JOIN geo.layers l ON l.code = v.layer_code
       WHERE v.id = ANY($1::uuid[])`,
      [ids],
    )) as Array<{
      id: string;
      layer_code: string;
      label: string;
      status: LayerVersionStatus;
      integrity_ok: boolean | null;
      row_count: number | null;
      checks: QualityCheck[];
      diff_summary: DiffSummary | null;
      usage: LayerUsage;
    }>;
    return rows.map((row) => ({
      id: row.id,
      layerCode: row.layer_code,
      label: row.label,
      status: row.status,
      integrityOk: row.integrity_ok,
      usage: row.usage,
      rowCount: row.row_count,
      checks: row.checks,
      diffSummary: row.diff_summary,
    }));
  }

  /** Phiên bản ready mới nhất của mỗi lớp còn dùng được (dựng bản phát hành 1 sau /reset). */
  async latestReadyPerLayer(): Promise<Record<string, string>> {
    const rows = (await this.dataSource.query(
      `SELECT DISTINCT ON (v.layer_code) v.layer_code, v.id
       FROM geo.layer_versions v JOIN geo.layers l ON l.code = v.layer_code
       WHERE v.status = 'ready' AND l.usage <> 'blocked' AND v.integrity_ok IS DISTINCT FROM false
       ORDER BY v.layer_code, v.ready_at DESC`,
    )) as Array<{ layer_code: string; id: string }>;
    return Object.fromEntries(rows.map((row) => [row.layer_code, row.id]));
  }

  private async getView(code: string): Promise<LayerView> {
    const all = await this.list();
    const found = all.find((layer) => layer.code === code);
    if (!found) throw new BusinessException(ErrorCode.NOT_FOUND, 'Không có lớp này.', { code: 'LAYER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return found;
  }

  /** id phiên bản lớp → các bản phát hành (nháp hoặc đã phát hành) đang trỏ tới nó. */
  private async releaseMembership(): Promise<Map<string, number[]>> {
    const rows = (await this.dataSource.query(
      `SELECT r.version, m.value AS layer_version_id
       FROM map_dataset_versions r CROSS JOIN LATERAL jsonb_each_text(r.layer_manifest) m
       WHERE r.status IN ('draft', 'published')`,
    )) as Array<{ version: number; layer_version_id: string }>;
    const map = new Map<string, number[]>();
    for (const row of rows) {
      const list = map.get(row.layer_version_id) ?? [];
      list.push(Number(row.version));
      map.set(row.layer_version_id, list);
    }
    return map;
  }

  private toVersionView(row: LayerVersionRow, releases: Map<string, number[]>): LayerVersionView {
    return {
      id: row.id,
      label: row.label,
      status: row.status,
      rowCount: row.row_count,
      packageSha256: row.package_sha256,
      integrityOk: row.integrity_ok,
      integrityCheckedAt: iso(row.integrity_checked_at),
      createdAt: row.created_at.toISOString(),
      readyAt: iso(row.ready_at),
      retiredAt: iso(row.retired_at),
      diffSummary: row.diff_summary,
      checks: row.checks,
      acceptedWarnings: row.accepted_warnings,
      sources: (row.manifest.sources ?? []).map((source) => ({ catalog: source.catalog, license: source.license })),
      inReleases: (releases.get(row.id) ?? []).sort((a, b) => b - a),
    };
  }
}
