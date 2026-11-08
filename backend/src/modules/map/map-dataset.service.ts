import { HttpStatus, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { buildCriteriaSnapshot, diffCriteria, hashCriteriaSnapshot, type CriterionChange } from './datasets/criteria-snapshot.js';
import type { DiffSummary, QualityCheck } from './datasets/datasets.types.js';
import { GeoLayersService, type LayerVersionRef } from './datasets/geo-layers.service.js';
import { GeoSchemaService } from './datasets/geo-schema.service.js';
import {
  MapDatasetVersionEntity,
  type DatasetReleaseKind,
  type DatasetReleaseStatus,
  type ReleaseCheck,
} from './entities/map-dataset-version.entity.js';
import { MAP_REDIS_KEYS } from './map.constants.js';
import { cleanText } from './map.mapper.js';

export interface DatasetVersionView {
  version: number;
  kind: DatasetReleaseKind;
  status: DatasetReleaseStatus;
  baseVersion: number | null;
  note: string;
  criteriaHash: string | null;
  backendCommit: string | null;
  createdBy: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  layerCount: number;
  current: boolean;
}

export interface ReleaseLayerView {
  layerCode: string;
  layerVersionId: string;
  label: string | null;
  status: string | null;
  rowCount: number | null;
  changedFromCurrent: boolean;
  diffSummary: DiffSummary | null;
  warnings: string[];
}

export interface DatasetVersionDetail extends DatasetVersionView {
  layers: ReleaseLayerView[];
  checks: ReleaseCheck[];
  goldenReport: Record<string, unknown> | null;
  criteriaChanged: Array<{ criterionId: string; change: CriterionChange }>;
}

/** Cache phiên bản hiện hành ngắn để phát hành có hiệu lực gần như ngay. */
const CURRENT_TTL_MS = 60_000;
const INITIAL_NOTE = 'Phiên bản khởi tạo của hệ thống.';
const DRAFT_KINDS: readonly DatasetReleaseKind[] = ['data', 'criteria', 'hotfix'];

/**
 * Trigger chặn sửa bảng kê và bản chụp tiêu chí sau khi bản rời `draft` (BR-02). Bảng do TypeORM quản lý nên
 * trigger được tạo lại idempotent mỗi lần khởi động và sau `/reset` (bước seed `map-dataset`).
 */
const RELEASE_GUARD_SQL = `
CREATE OR REPLACE FUNCTION public.map_dataset_versions_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'draft' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'map_dataset_versions: không xóa bản đã rời draft' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status <> 'draft' AND (
       NEW.version <> OLD.version OR NEW.kind <> OLD.kind
       OR NEW.base_version IS DISTINCT FROM OLD.base_version
       OR NEW.layer_manifest IS DISTINCT FROM OLD.layer_manifest
       OR NEW.criteria_snapshot IS DISTINCT FROM OLD.criteria_snapshot
       OR NEW.criteria_hash IS DISTINCT FROM OLD.criteria_hash
       OR NEW.checks IS DISTINCT FROM OLD.checks
       OR NEW.golden_report IS DISTINCT FROM OLD.golden_report
       OR NEW.released_at IS DISTINCT FROM OLD.released_at
       OR NEW.released_by IS DISTINCT FROM OLD.released_by) THEN
    RAISE EXCEPTION 'map_dataset_versions: bản % đã rời draft, không sửa được nội dung', OLD.version
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status = 'published' AND NEW.status NOT IN ('published', 'withdrawn') THEN
    RAISE EXCEPTION 'map_dataset_versions: bản đã phát hành chỉ chuyển sang withdrawn' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status IN ('withdrawn', 'abandoned') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'map_dataset_versions: trạng thái cuối, không đổi được' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_map_dataset_versions_guard ON map_dataset_versions;
CREATE TRIGGER trg_map_dataset_versions_guard BEFORE UPDATE OR DELETE ON map_dataset_versions
  FOR EACH ROW EXECUTE FUNCTION public.map_dataset_versions_guard();
`;

function releaseError(code: string, message: string, details: Record<string, unknown> = {}, status = HttpStatus.CONFLICT): BusinessException {
  return new BusinessException(status === HttpStatus.NOT_FOUND ? ErrorCode.NOT_FOUND : ErrorCode.CONFLICT, message, { code, ...details }, status);
}

function hasBlockingFailure(checks: readonly ReleaseCheck[]): boolean {
  return checks.some((check) => check.severity === 'blocking' && check.status === 'fail');
}

/**
 * Bản phát hành dữ liệu đánh giá (018-location-data): nháp → phát hành → thu hồi bằng bản mới.
 * Lượt đánh giá cũ giữ nguyên phiên bản đã ghim, không tự cập nhật.
 */
@Injectable()
export class MapDatasetService implements OnModuleInit {
  private readonly logger = new Logger(MapDatasetService.name);

  constructor(
    @InjectRepository(MapDatasetVersionEntity) private readonly versions: Repository<MapDatasetVersionEntity>,
    private readonly redis: RedisService,
    private readonly geoSchema: GeoSchemaService,
    private readonly layers: GeoLayersService,
  ) {}

  /** Tạo trigger bảo vệ và bảo đảm luôn có bản 1 (cũng chạy lại sau /reset). */
  async onModuleInit(): Promise<void> {
    try {
      await this.versions.query(RELEASE_GUARD_SQL);
    } catch (error) {
      this.logger.warn(`Không tạo được trigger bảo vệ bản phát hành: ${errorText(error)}`);
    }
    try {
      const manifest = (await this.geoSchema.ensure()) ? await this.layers.latestReadyPerLayer() : {};
      const snapshot = buildCriteriaSnapshot();
      await this.versions
        .createQueryBuilder()
        .insert()
        .values({
          version: 1,
          note: INITIAL_NOTE,
          kind: 'data',
          status: 'published',
          layerManifest: manifest,
          criteriaSnapshot: snapshot,
          criteriaHash: hashCriteriaSnapshot(snapshot),
          releasedBy: null,
          releasedAt: new Date(),
        })
        .orIgnore()
        .execute();
    } catch (error) {
      this.logger.warn(`Không khởi tạo được phiên bản dữ liệu: ${errorText(error)}`);
    }
  }

  async current(): Promise<number> {
    try {
      const cached = await this.redis.get<number>(MAP_REDIS_KEYS.datasetCurrent);
      if (typeof cached === 'number' && Number.isInteger(cached) && cached > 0) return cached;
    } catch (error) {
      this.logger.warn(`Đọc phiên bản dữ liệu từ Redis lỗi: ${errorText(error)}`);
    }
    const value = await this.currentFromDb(this.versions.manager);
    try {
      await this.redis.set(MAP_REDIS_KEYS.datasetCurrent, value, CURRENT_TTL_MS);
    } catch {
      // Redis lỗi thì lần sau đọc DB tiếp, không chặn đánh giá.
    }
    return value;
  }

  async list(): Promise<DatasetVersionView[]> {
    const rows = await this.versions.find({ order: { version: 'DESC' }, take: 100 });
    const current = await this.currentFromDb(this.versions.manager);
    return rows.map((row) => this.toView(row, current));
  }

  async detail(version: number): Promise<DatasetVersionDetail> {
    const row = await this.findOrFail(this.versions.manager, version);
    const currentVersion = await this.currentFromDb(this.versions.manager);
    const currentRow = await this.versions.findOne({ where: { version: currentVersion } });
    const currentManifest = currentRow?.layerManifest ?? {};
    const refs = await this.layerRefs(Object.values(row.layerManifest));
    const layers = Object.entries(row.layerManifest)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([layerCode, layerVersionId]) => {
        const ref = refs.get(layerVersionId);
        return {
          layerCode,
          layerVersionId,
          label: ref?.label ?? null,
          status: ref?.status ?? null,
          rowCount: ref?.rowCount ?? null,
          changedFromCurrent: currentManifest[layerCode] !== layerVersionId,
          diffSummary: ref?.diffSummary ?? null,
          warnings: (ref?.checks ?? []).filter((check) => check.severity === 'warning' && check.status === 'fail').map((check) => check.code),
        };
      });
    const snapshot = row.status === 'draft' ? buildCriteriaSnapshot() : row.criteriaSnapshot;
    const baseSnapshot = row.status === 'draft' ? (currentRow?.criteriaSnapshot ?? []) : this.previousSnapshot(row, currentRow);
    return {
      ...this.toView(row, currentVersion),
      layers,
      checks: row.checks,
      goldenReport: row.goldenReport,
      criteriaChanged: diffCriteria(baseSnapshot, snapshot.filter(isSnapshotLike)),
    };
  }

  /** Tạo bản nháp, chép bảng kê từ bản hiện hành. Mỗi lúc chỉ một bản nháp (unique partial index). */
  async createDraft(adminId: string, kind: DatasetReleaseKind, note: string): Promise<DatasetVersionDetail> {
    if (!DRAFT_KINDS.includes(kind)) throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Loại bản nháp không hợp lệ.');
    const clean = this.cleanNote(note);
    const created = await this.versions.manager.transaction(async (manager) => {
      await manager.query('LOCK TABLE map_dataset_versions IN SHARE ROW EXCLUSIVE MODE');
      const repo = manager.getRepository(MapDatasetVersionEntity);
      if (await repo.exists({ where: { status: 'draft' } })) {
        throw releaseError('RELEASE_DRAFT_EXISTS', 'Đã có một bản nháp. Sửa tiếp hoặc bỏ bản nháp đó trước.');
      }
      const currentVersion = await this.currentFromDb(manager);
      const base = await repo.findOne({ where: { version: currentVersion } });
      const next = await this.nextVersion(manager);
      return repo.save(
        repo.create({
          version: next,
          note: clean,
          kind,
          status: 'draft',
          baseVersion: base?.version ?? null,
          layerManifest: base?.layerManifest ?? {},
          criteriaSnapshot: [],
          criteriaHash: null,
          createdBy: adminId,
          releasedBy: null,
          releasedAt: null,
        }),
      );
    });
    this.logger.log(`Admin ${adminId} tạo bản nháp ${created.version}`);
    return this.detail(created.version);
  }

  async setLayer(version: number, layerCode: string, layerVersionId: string): Promise<DatasetVersionDetail> {
    await this.geoSchema.assertReady();
    await this.versions.manager.transaction(async (manager) => {
      const row = await this.lockDraft(manager, version);
      const [ref] = await this.layers.findVersions([layerVersionId]);
      if (!ref) throw releaseError('LAYER_VERSION_NOT_FOUND', 'Không có phiên bản lớp này.', {}, HttpStatus.NOT_FOUND);
      if (ref.layerCode !== layerCode) throw releaseError('LAYER_MISMATCH', 'Phiên bản không thuộc lớp này.');
      if (ref.status !== 'ready') throw releaseError('LAYER_NOT_READY', 'Chỉ chọn được phiên bản lớp đang ready.');
      if (ref.integrityOk === false) throw releaseError('INTEGRITY_FAILED', 'Phiên bản lớp này có dữ liệu bị đổi ngoài đường nhập.');
      if (ref.usage === 'blocked') throw releaseError('SOURCE_BLOCKED', 'Lớp đang bị chặn (usage = blocked).');
      await manager.update(MapDatasetVersionEntity, { version }, { layerManifest: { ...row.layerManifest, [layerCode]: layerVersionId } });
    });
    return this.detail(version);
  }

  async removeLayer(version: number, layerCode: string): Promise<DatasetVersionDetail> {
    await this.versions.manager.transaction(async (manager) => {
      const row = await this.lockDraft(manager, version);
      const manifest = { ...row.layerManifest };
      delete manifest[layerCode];
      await manager.update(MapDatasetVersionEntity, { version }, { layerManifest: manifest });
    });
    return this.detail(version);
  }

  async abandon(version: number, adminId: string): Promise<DatasetVersionView> {
    await this.versions.manager.transaction(async (manager) => {
      await this.lockDraft(manager, version);
      await manager.update(MapDatasetVersionEntity, { version }, { status: 'abandoned' });
    });
    this.logger.log(`Admin ${adminId} bỏ bản nháp ${version}`);
    const row = await this.findOrFail(this.versions.manager, version);
    return this.toView(row, await this.currentFromDb(this.versions.manager));
  }

  /**
   * Phát hành: khóa bản nháp, chạy kiểm tra mức bản, chụp tiêu chí từ code, chuyển published trong một
   * transaction. Có cảnh báo thì admin phải ghi lý do (`acceptWarnings`).
   */
  async publish(version: number, adminId: string, acceptWarnings: string | undefined): Promise<DatasetVersionView> {
    const reason = acceptWarnings ? cleanText(acceptWarnings, 500) : '';
    const published = await this.versions.manager.transaction(async (manager) => {
      const row = await this.lockDraft(manager, version);
      const checks = await this.releaseChecks(row.layerManifest);
      if (hasBlockingFailure(checks)) {
        throw releaseError('RELEASE_BLOCKED', 'Bản nháp chưa qua kiểm tra chặn.', { checks });
      }
      const warnings = checks.filter((check) => check.severity === 'warning' && check.status === 'fail');
      if (warnings.length > 0 && reason.length < 3) {
        throw releaseError('WARNINGS_NOT_ACCEPTED', 'Có cảnh báo: ghi lý do chấp nhận để phát hành.', { checks });
      }
      const snapshot = buildCriteriaSnapshot();
      const releasedAt = new Date();
      await manager.update(
        MapDatasetVersionEntity,
        { version },
        {
          status: 'published',
          criteriaSnapshot: snapshot,
          criteriaHash: hashCriteriaSnapshot(snapshot),
          checks,
          goldenReport: {
            skipped: true,
            reason: 'Chưa có logic đánh giá từ dữ liệu nền; điểm mẫu sẽ chạy khi có (research.md Bản ghi 14).',
          },
          backendCommit: backendCommit(),
          note: reason ? `${row.note} — Chấp nhận cảnh báo: ${reason}`.slice(0, 500) : row.note,
          releasedBy: adminId,
          releasedAt,
        },
      );
      return this.findOrFail(manager, version);
    });
    await this.clearCurrentCache();
    this.logger.log(`Admin ${adminId} phát hành bản dữ liệu ${version}`);
    return this.toView(published, version);
  }

  /** Thu hồi bản hiện hành: tạo và phát hành ngay bản rollback chép bảng kê và bản chụp của `baseVersion`. */
  async withdraw(version: number, adminId: string, reason: string, baseVersion: number): Promise<DatasetVersionView> {
    const cleanReason = this.cleanNote(reason);
    const created = await this.versions.manager.transaction(async (manager) => {
      await manager.query('LOCK TABLE map_dataset_versions IN SHARE ROW EXCLUSIVE MODE');
      const repo = manager.getRepository(MapDatasetVersionEntity);
      const currentVersion = await this.currentFromDb(manager);
      if (version !== currentVersion) throw releaseError('NOT_CURRENT', 'Chỉ thu hồi được bản đang hiện hành.');
      if (await repo.exists({ where: { status: 'draft' } })) {
        throw releaseError('RELEASE_DRAFT_EXISTS', 'Đang có bản nháp. Bỏ hoặc phát hành bản nháp trước khi thu hồi.');
      }
      const base = await repo.findOne({ where: { version: baseVersion } });
      if (!base || base.status !== 'published' || base.version >= version) {
        throw releaseError('BASE_INVALID', 'Bản gốc phải là một bản đã phát hành, cũ hơn bản đang thu hồi.');
      }
      const refs = await this.layerRefs(Object.values(base.layerManifest));
      const unavailable = Object.entries(base.layerManifest)
        .filter(([, id]) => refs.get(id)?.status !== 'ready')
        .map(([layerCode, layerVersionId]) => ({ layerCode, layerVersionId, status: refs.get(layerVersionId)?.status ?? 'missing' }));
      if (unavailable.length > 0) {
        throw releaseError('BASE_LAYER_RETIRED', 'Bản gốc có phiên bản lớp đã dọn; khôi phục từ gói trước khi thu hồi.', { layers: unavailable });
      }
      const next = await this.nextVersion(manager);
      const now = new Date();
      await repo.update({ version }, { status: 'withdrawn', withdrawnAt: now, withdrawReason: cleanReason });
      return repo.save(
        repo.create({
          version: next,
          note: `Thu hồi bản ${version} về bản ${base.version}: ${cleanReason}`.slice(0, 500),
          kind: 'rollback',
          status: 'published',
          baseVersion: base.version,
          layerManifest: base.layerManifest,
          criteriaSnapshot: base.criteriaSnapshot,
          criteriaHash: base.criteriaHash,
          checks: [],
          goldenReport: null,
          backendCommit: backendCommit(),
          createdBy: adminId,
          releasedBy: adminId,
          releasedAt: now,
        }),
      );
    });
    await this.clearCurrentCache();
    this.logger.log(`Admin ${adminId} thu hồi bản ${version}, bản mới ${created.version} theo bản ${baseVersion}`);
    return this.toView(created, created.version);
  }

  /** Kiểm tra mức bản (data-change-playbook.md). Điểm mẫu chưa chạy vì chưa có logic đánh giá từ dữ liệu nền. */
  private async releaseChecks(manifest: Record<string, string>): Promise<ReleaseCheck[]> {
    const ids = Object.values(manifest);
    const isGeoReady = await this.geoSchema.ensure();
    const refs = isGeoReady ? await this.layerRefs(ids) : new Map<string, LayerVersionRef>();
    const entries = Object.entries(manifest);
    const notReady = entries.filter(([, id]) => refs.get(id)?.status !== 'ready').map(([code]) => code);
    const mismatched = entries.filter(([code, id]) => refs.get(id) && refs.get(id)?.layerCode !== code).map(([code]) => code);
    const brokenIntegrity = entries.filter(([, id]) => refs.get(id)?.integrityOk === false).map(([code]) => code);
    const blocked = entries.filter(([, id]) => refs.get(id)?.usage === 'blocked').map(([code]) => code);
    return [
      check('layers_ready', 'blocking', notReady.length === 0 && mismatched.length === 0, 'mọi phiên bản lớp ready, đúng lớp', listOrOk([...notReady, ...mismatched])),
      check('integrity', 'blocking', brokenIntegrity.length === 0, 'không có phiên bản bị đổi ngoài đường nhập', listOrOk(brokenIntegrity)),
      check('source_blocked', 'blocking', blocked.length === 0, 'không có lớp usage = blocked', listOrOk(blocked)),
      check('layers_present', 'warning', entries.length > 0, 'ít nhất một lớp', entries.length === 0 ? 'bảng kê rỗng: đánh giá vẫn ở chế độ mẫu' : `${entries.length} lớp`),
    ];
  }

  private async layerRefs(ids: readonly string[]): Promise<Map<string, LayerVersionRef>> {
    if (ids.length === 0 || !(await this.geoSchema.ensure())) return new Map();
    const refs = await this.layers.findVersions(ids);
    return new Map(refs.map((ref) => [ref.id, ref]));
  }

  private previousSnapshot(row: MapDatasetVersionEntity, currentRow: MapDatasetVersionEntity | null): unknown[] {
    if (currentRow && currentRow.version !== row.version) return currentRow.criteriaSnapshot;
    return row.criteriaSnapshot;
  }

  private async lockDraft(manager: EntityManager, version: number): Promise<MapDatasetVersionEntity> {
    const row = await manager
      .getRepository(MapDatasetVersionEntity)
      .createQueryBuilder('v')
      .setLock('pessimistic_write')
      .where('v.version = :version', { version })
      .getOne();
    if (!row) throw releaseError('RELEASE_NOT_FOUND', 'Không có bản này.', {}, HttpStatus.NOT_FOUND);
    if (row.status !== 'draft') throw releaseError('RELEASE_NOT_DRAFT', 'Bản này không còn là bản nháp.');
    return row;
  }

  private async findOrFail(manager: EntityManager, version: number): Promise<MapDatasetVersionEntity> {
    const row = await manager.getRepository(MapDatasetVersionEntity).findOne({ where: { version } });
    if (!row) throw releaseError('RELEASE_NOT_FOUND', 'Không có bản này.', {}, HttpStatus.NOT_FOUND);
    return row;
  }

  private async currentFromDb(manager: EntityManager): Promise<number> {
    const row = await manager
      .getRepository(MapDatasetVersionEntity)
      .createQueryBuilder('v')
      .select('MAX(v.version)', 'max')
      .where('v.status = :status', { status: 'published' })
      .getRawOne<{ max: number | null }>();
    return row?.max ? Number(row.max) : 1;
  }

  private async nextVersion(manager: EntityManager): Promise<number> {
    const row = await manager
      .getRepository(MapDatasetVersionEntity)
      .createQueryBuilder('v')
      .select('MAX(v.version)', 'max')
      .getRawOne<{ max: number | null }>();
    return (row?.max ? Number(row.max) : 0) + 1;
  }

  private cleanNote(note: string): string {
    const clean = cleanText(note, 500);
    if (clean.length < 3) throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Ghi chú cần ít nhất 3 ký tự.');
    return clean;
  }

  private async clearCurrentCache(): Promise<void> {
    try {
      await this.redis.del(MAP_REDIS_KEYS.datasetCurrent);
    } catch (error) {
      this.logger.warn(`Xóa cache phiên bản dữ liệu lỗi: ${errorText(error)}`);
    }
  }

  private toView(row: MapDatasetVersionEntity, current: number): DatasetVersionView {
    return {
      version: row.version,
      kind: row.kind,
      status: row.status,
      baseVersion: row.baseVersion,
      note: row.note,
      criteriaHash: row.criteriaHash,
      backendCommit: row.backendCommit,
      createdBy: row.createdBy,
      releasedBy: row.releasedBy,
      releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
      withdrawnAt: row.withdrawnAt ? row.withdrawnAt.toISOString() : null,
      withdrawReason: row.withdrawReason,
      layerCount: Object.keys(row.layerManifest ?? {}).length,
      current: row.status === 'published' && row.version === current,
    };
  }
}

function check(code: string, severity: QualityCheck['severity'], isPass: boolean, expected: string, observed: string): ReleaseCheck {
  return { code, severity, status: isPass ? 'pass' : 'fail', expected, observed };
}

function listOrOk(items: readonly string[]): string {
  return items.length === 0 ? 'đạt' : items.join(', ');
}

function isSnapshotLike(value: unknown): value is { id: string; definition: unknown; defaultWeight: number | null } {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

/** Commit backend nếu môi trường build có cung cấp (GIT_COMMIT); không có thì null. */
function backendCommit(): string | null {
  const value = process.env.GIT_COMMIT?.trim();
  return value && /^[0-9a-f]{7,40}$/.test(value) ? value : null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
