import { HttpStatus, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, type QueryRunner } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { BusinessException } from '../../../common/exceptions/business.exception.js';
import { RedisService } from '../../../integrations/redis/redis.service.js';
import { StorageService } from '../../../integrations/storage/storage.service.js';
import { ErrorCode } from '../../../shared/constants/error-code.constant.js';
import { MAP_REDIS_KEYS } from '../map.constants.js';
import type { DiffSummary, ImportJobStatus, ImportJobView, ImportPurpose, QualityCheck, UploadTicket } from './datasets.types.js';
import { GeoLayersService } from './geo-layers.service.js';
import { GeoSchemaService } from './geo-schema.service.js';
import { extractArchiveEntry, PackageArchiveError, readArchiveEntries, type ArchiveEntry } from './package-archive.js';
import { contentHashSql, featureTable, runChecks, stagingTable, type BaseVersion } from './package-checks.js';
import {
  CONTRACTS,
  COVERAGE_FILE,
  MANIFEST_FILE,
  PACKAGE_BBOX,
  PACKAGE_LIMITS,
  parseManifest,
  type ContractId,
  type GeometryKind,
  type PackageManifest,
} from './package-contracts.js';
import { CsvFormatError } from './csv-reader.js';
import { loadPackageData, PackageDataError } from './package-loader.js';

/** Khóa advisory "mỗi lúc một job kiểm tra hoặc lưu" (data-change-playbook.md tình huống 28). */
const IMPORT_LOCK_KEY = 180_002;
const UPLOAD_TTL_SECONDS = 600;
const QUEUE_TICK_MS = 60_000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const VALIDATED_EXPIRE_DAYS = 7;
const PACKAGE_KEEP_DAYS = 30;
const RETIRE_AFTER_DAYS = 30;
const ZIP_CONTENT_TYPE = 'application/zip';
const ACTIVE_STATUSES: readonly ImportJobStatus[] = ['uploaded', 'validating', 'validated', 'saving', 'saved'];

interface UploadTicketState {
  adminId: string;
  sizeBytes: number;
}

interface JobRow {
  id: string;
  layer_code: string;
  label: string;
  contract: ContractId;
  purpose: ImportPurpose;
  status: ImportJobStatus;
  package_key: string;
  package_sha256: string;
  size_bytes: string;
  manifest: PackageManifest;
  checks: QualityCheck[];
  diff_summary: DiffSummary | null;
  preview: Array<Record<string, unknown>> | null;
  row_count: number | null;
  error: string | null;
  uploaded_by: string;
  decided_by: string | null;
  accepted_warnings: string | null;
  layer_version_id: string | null;
  created_at: Date;
  finished_at: Date | null;
}

const JOB_COLUMNS = `id, layer_code, label, contract, purpose, status, package_key, package_sha256, size_bytes, manifest, checks,
  diff_summary, preview, row_count, error, uploaded_by, decided_by, accepted_warnings, layer_version_id, created_at, finished_at`;

function importError(code: string, message: string, status = HttpStatus.CONFLICT, details: Record<string, unknown> = {}): BusinessException {
  const errorCode =
    status === HttpStatus.NOT_FOUND
      ? ErrorCode.NOT_FOUND
      : status === HttpStatus.PAYLOAD_TOO_LARGE
        ? ErrorCode.FILE_TOO_LARGE
        : status === HttpStatus.UNPROCESSABLE_ENTITY
          ? ErrorCode.VALIDATION_ERROR
          : ErrorCode.CONFLICT;
  return new BusinessException(errorCode, message, { code, ...details }, status);
}

/** Bỏ ký tự điều khiển trước khi ghi log hoặc lưu thông báo lỗi (chống giả mạo log). */
function safeMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/[\r\n\t]+/g, ' ').slice(0, 900);
}

/**
 * Đường ghi duy nhất của dữ liệu nền (research.md Bản ghi 12): gói chuẩn tải thẳng lên kho bằng URL ký sẵn →
 * kiểm hình dạng và manifest → lưu gói theo sha256 → nạp vào geo_staging và kiểm tra ở nền → admin Lưu (chép sang
 * geo trong một transaction) hoặc Bỏ.
 */
@Injectable()
export class DatasetImportService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DatasetImportService.name);
  private queueTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private drainPromise: Promise<void> | null = null;
  private isRerunNeeded = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
    private readonly geoSchema: GeoSchemaService,
    private readonly layers: GeoLayersService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!(await this.geoSchema.ensure())) return;
    await this.recoverInterrupted();
    this.queueTimer = setInterval(() => void this.drainQueue(), QUEUE_TICK_MS);
    this.queueTimer.unref();
    this.cleanupTimer = setInterval(() => void this.cleanup(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
    void this.drainQueue();
  }

  onModuleDestroy(): void {
    if (this.queueTimer) clearInterval(this.queueTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  // ───────────────────────────── tải lên ─────────────────────────────

  /** Phiếu tải lên: URL ký sẵn PUT thẳng lên kho (qua proxy website sẽ vướng giới hạn kích thước body). */
  async createUploadTicket(adminId: string, sizeBytes: number): Promise<UploadTicket> {
    await this.geoSchema.assertReady();
    if (sizeBytes > PACKAGE_LIMITS.packageMaxBytes) {
      throw importError('PACKAGE_TOO_LARGE', `Gói tối đa ${Math.round(PACKAGE_LIMITS.packageMaxBytes / 1024 / 1024)} MB.`, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const uploadId = uuidv7();
    const url = await this.storage.getPresignedPutUrl(this.incomingKey(uploadId), ZIP_CONTENT_TYPE, UPLOAD_TTL_SECONDS, { contentLength: sizeBytes });
    const state: UploadTicketState = { adminId, sizeBytes };
    await this.redis.set(MAP_REDIS_KEYS.datasetUpload(uploadId), state, UPLOAD_TTL_SECONDS * 1000);
    return {
      uploadId,
      url,
      method: 'PUT',
      headers: { 'content-type': ZIP_CONTENT_TYPE },
      expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
      maxBytes: PACKAGE_LIMITS.packageMaxBytes,
    };
  }

  /** Nhận gói đã tải lên: kiểm hình dạng, manifest, lớp, trùng lặp; lưu vào kho gói; xếp hàng kiểm tra. */
  async submitUpload(adminId: string, uploadId: string): Promise<ImportJobView> {
    await this.geoSchema.assertReady();
    const ticketKey = MAP_REDIS_KEYS.datasetUpload(uploadId);
    const ticket = await this.redis.get<UploadTicketState>(ticketKey);
    if (!ticket || ticket.adminId !== adminId) {
      throw importError('UPLOAD_NOT_FOUND', 'Phiếu tải lên không tồn tại hoặc đã hết hạn. Tải lại gói.', HttpStatus.NOT_FOUND);
    }
    await this.redis.del(ticketKey);
    const incoming = this.incomingKey(uploadId);
    const workDir = await mkdtemp(join(tmpdir(), 'geo-upload-'));
    try {
      const size = await this.storage.objectSize(incoming);
      if (size === null) throw importError('UPLOAD_MISSING', 'Chưa thấy gói trên kho. Tải lên chưa xong?', HttpStatus.UNPROCESSABLE_ENTITY);
      if (size !== ticket.sizeBytes || size > PACKAGE_LIMITS.packageMaxBytes) {
        throw importError('PACKAGE_TOO_LARGE', 'Kích thước gói không khớp phiếu tải lên hoặc vượt giới hạn.', HttpStatus.PAYLOAD_TOO_LARGE);
      }
      const packagePath = join(workDir, 'package.zip');
      await this.storage.downloadObjectToFile(incoming, packagePath);
      const sha256 = await sha256File(packagePath);
      const { manifest } = await this.inspectPackage(packagePath, workDir);
      await this.assertAcceptable(manifest, sha256);

      const packageKey = `datasets/packages/${manifest.layer}/${sha256}.zip`;
      await this.storage.putObjectFromFile(packageKey, packagePath, size, ZIP_CONTENT_TYPE);
      const jobId = uuidv7();
      try {
        await this.dataSource.query(
          `INSERT INTO geo.import_jobs (id, layer_code, label, contract, purpose, status, package_key, package_sha256, size_bytes, manifest, uploaded_by)
           VALUES ($1, $2, $3, $4, 'new', 'uploaded', $5, $6, $7, $8::jsonb, $9)`,
          [jobId, manifest.layer, manifest.label, manifest.contract, packageKey, sha256, size, JSON.stringify(manifest), adminId],
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw importError('PACKAGE_DUPLICATE', 'Gói này (hoặc label này) đã được nhập.');
        throw error;
      }
      this.logger.log(`Admin ${adminId} tải gói ${manifest.layer}/${manifest.label} (${sha256.slice(0, 12)})`);
      void this.drainQueue();
      return this.get(jobId);
    } catch (error) {
      if (error instanceof PackageArchiveError) {
        throw importError('PACKAGE_SHAPE_INVALID', error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true });
      await this.storage.deleteObject(incoming).catch((error: unknown) => this.logger.warn(`Không xóa được gói tạm: ${safeMessage(error)}`));
    }
  }

  async list(status?: ImportJobStatus, layerCode?: string): Promise<ImportJobView[]> {
    await this.geoSchema.assertReady();
    const rows = (await this.dataSource.query(
      `SELECT ${JOB_COLUMNS} FROM geo.import_jobs
       WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR layer_code = $2)
       ORDER BY created_at DESC LIMIT 100`,
      [status ?? null, layerCode ?? null],
    )) as JobRow[];
    return rows.map((row) => this.toView(row, false));
  }

  async get(jobId: string): Promise<ImportJobView> {
    await this.geoSchema.assertReady();
    return this.toView(await this.findJob(this.dataSource, jobId), true);
  }

  // ───────────────────────────── lưu / bỏ ─────────────────────────────

  /** Lưu: chép staging sang geo trong một transaction, tính content_hash, phiên bản lớp ready. */
  async save(jobId: string, adminId: string, acceptWarnings: string | undefined): Promise<ImportJobView> {
    await this.geoSchema.assertReady();
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      if (!(await this.tryLock(runner))) throw importError('IMPORT_BUSY', 'Đang có gói khác được kiểm tra hoặc lưu. Thử lại sau ít phút.');
      try {
        await this.saveLocked(runner, jobId, adminId, acceptWarnings?.trim() ?? '');
      } finally {
        await this.unlock(runner);
      }
    } finally {
      await runner.release();
    }
    void this.drainQueue();
    return this.get(jobId);
  }

  async discard(jobId: string, adminId: string): Promise<ImportJobView> {
    await this.geoSchema.assertReady();
    const updated = (await this.dataSource.query(
      `UPDATE geo.import_jobs SET status = 'discarded', decided_by = $2, finished_at = now(), updated_at = now()
       WHERE id = $1 AND status IN ('uploaded', 'validated', 'rejected', 'failed') RETURNING id`,
      [jobId, adminId],
    )) as unknown;
    if (rowsOf<{ id: string }>(updated).length === 0) {
      await this.findJob(this.dataSource, jobId);
      throw importError('IMPORT_NOT_DISCARDABLE', 'Job đang chạy hoặc đã lưu, không bỏ được.');
    }
    await this.clearStaging(this.dataSource, jobId);
    return this.get(jobId);
  }

  private async saveLocked(runner: QueryRunner, jobId: string, adminId: string, acceptWarnings: string): Promise<void> {
    const job = await this.findJob(runner, jobId);
    if (job.status !== 'validated') throw importError('IMPORT_NOT_VALIDATED', 'Chỉ lưu được job đã kiểm tra đạt (validated).');
    const hasBlocking = job.checks.some((item) => item.severity === 'blocking' && item.status === 'fail');
    if (hasBlocking) throw importError('IMPORT_BLOCKED', 'Gói có kiểm tra chặn chưa đạt.');
    const hasWarnings = job.checks.some((item) => item.severity === 'warning' && item.status === 'fail');
    if (hasWarnings && acceptWarnings.length < 3) throw importError('WARNINGS_NOT_ACCEPTED', 'Có cảnh báo: ghi lý do chấp nhận để lưu.');
    const layer = await this.layers.findLayer(job.layer_code);
    if (layer.usage === 'blocked') throw importError('SOURCE_BLOCKED', 'Lớp đang bị chặn (usage = blocked).');

    const kind = CONTRACTS[job.contract].geometryKind;
    const versionId = uuidv7();
    await runner.startTransaction();
    try {
      await runner.query(`UPDATE geo.import_jobs SET status = 'saving', updated_at = now() WHERE id = $1`, [jobId]);
      await runner.query(`SET LOCAL geo.write_mode = 'ingest'`);
      await runner.query(
        `INSERT INTO geo.layer_versions (id, layer_code, label, status, import_job_id, package_sha256, manifest, checks, diff_summary, accepted_warnings)
         VALUES ($1, $2, $3, 'building', $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9)`,
        [
          versionId,
          job.layer_code,
          job.label,
          jobId,
          job.package_sha256,
          JSON.stringify(job.manifest),
          JSON.stringify(job.checks),
          JSON.stringify(job.diff_summary),
          hasWarnings ? acceptWarnings.slice(0, 500) : null,
        ],
      );
      await runner.query(copyFeaturesSql(kind), kind === 'grid' ? [versionId, jobId, job.manifest.gridCode] : [versionId, jobId]);
      const hashRows = (await runner.query(contentHashSql(kind), [versionId])) as Array<{ hash: string }>;
      const countRows = (await runner.query(`SELECT count(*)::int AS n FROM ${featureTable(kind)} WHERE layer_version_id = $1`, [versionId])) as Array<{
        n: number;
      }>;
      await runner.query(
        `UPDATE geo.layer_versions SET
           status = 'ready', ready_at = now(), row_count = $2, content_hash = $3, integrity_ok = true, integrity_checked_at = now(),
           coverage = (SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)) FROM geo_staging.coverages WHERE job_id = $4)
         WHERE id = $1`,
        [versionId, countRows[0]?.n ?? 0, hashRows[0]?.hash ?? null, jobId],
      );
      await runner.query(
        `UPDATE geo.import_jobs SET status = 'saved', decided_by = $2, accepted_warnings = $3, layer_version_id = $4,
           finished_at = now(), updated_at = now() WHERE id = $1`,
        [jobId, adminId, hasWarnings ? acceptWarnings.slice(0, 500) : null, versionId],
      );
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      this.logger.error(`Lưu job ${jobId} lỗi: ${safeMessage(error)}`);
      throw importError('IMPORT_SAVE_FAILED', 'Lưu gói không thành công; dữ liệu nền không đổi. Xem log backend.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    await this.clearStaging(runner, jobId);
    this.logger.log(`Admin ${adminId} lưu ${job.layer_code}/${job.label} thành phiên bản ${versionId}`);
  }

  // ───────────────────────────── kiểm tra nền ─────────────────────────────

  /**
   * Lấy lần lượt các job `uploaded` và kiểm tra. Gọi khi đang chạy thì chờ lượt hiện tại và chạy thêm một lượt.
   * Khóa advisory bảo đảm mỗi lúc một job trên mọi instance.
   */
  drainQueue(): Promise<void> {
    if (this.drainPromise) {
      this.isRerunNeeded = true;
      return this.drainPromise;
    }
    this.drainPromise = (async () => {
      try {
        do {
          this.isRerunNeeded = false;
          await this.drainOnce();
        } while (this.isRerunNeeded);
      } finally {
        this.drainPromise = null;
      }
    })();
    return this.drainPromise;
  }

  private async drainOnce(): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      if (!(await this.tryLock(runner))) return;
      try {
        for (;;) {
          const next = (await runner.query(
            `UPDATE geo.import_jobs SET status = 'validating', updated_at = now()
             WHERE id = (SELECT id FROM geo.import_jobs WHERE status = 'uploaded' ORDER BY created_at LIMIT 1)
             RETURNING id`,
          )) as unknown;
          const id = rowsOf<{ id: string }>(next)[0]?.id;
          if (!id) break;
          await this.validate(runner, id);
        }
      } finally {
        await this.unlock(runner);
      }
    } catch (error) {
      this.logger.error(`Hàng đợi nhập gói lỗi: ${safeMessage(error)}`);
    } finally {
      await runner.release();
    }
  }

  private async validate(runner: QueryRunner, jobId: string): Promise<void> {
    const job = await this.findJob(runner, jobId);
    const workDir = await mkdtemp(join(tmpdir(), 'geo-import-'));
    try {
      await this.clearStaging(runner, jobId);
      const packagePath = join(workDir, 'package.zip');
      await this.storage.downloadObjectToFile(job.package_key, packagePath);
      if ((await sha256File(packagePath)) !== job.package_sha256) {
        throw new PackageDataError('Gói trong kho không khớp sha256 lúc nhận (bị thay?).');
      }
      const { manifest, entries } = await this.inspectPackage(packagePath, workDir);
      const spec = CONTRACTS[manifest.contract];
      const dataEntry = entries.find((entry) => entry.name === spec.dataFile);
      if (!dataEntry) throw new PackageDataError(`Gói thiếu ${spec.dataFile}.`);
      const dataPath = join(workDir, 'data');
      await extractArchiveEntry(packagePath, dataEntry, dataPath);
      const dataSha256 = await sha256File(dataPath);
      const srid = Number(manifest.crs.split(':')[1]);

      const load = await loadPackageData(runner, jobId, spec.geometryKind, spec, dataPath, srid);
      await this.loadCoverage(runner, jobId, entries, packagePath, workDir, srid);
      const base = await this.currentBase(runner, job.layer_code);
      const result = await runChecks(runner, { jobId, geometryKind: spec.geometryKind, manifest, load, dataSha256, base });
      const isRejected = result.checks.some((item) => item.severity === 'blocking' && item.status === 'fail');
      await runner.query(
        `UPDATE geo.import_jobs SET status = $2::text, checks = $3::jsonb, diff_summary = $4::jsonb, preview = $5::jsonb, row_count = $6,
           finished_at = CASE WHEN $2::text = 'rejected' THEN now() ELSE NULL END, updated_at = now()
         WHERE id = $1`,
        [jobId, isRejected ? 'rejected' : 'validated', JSON.stringify(result.checks), JSON.stringify(result.diffSummary), JSON.stringify(result.preview), load.loadedRows],
      );
      if (isRejected) await this.clearStaging(runner, jobId);
      this.logger.log(`Job ${jobId} ${isRejected ? 'bị từ chối' : 'kiểm tra đạt'} (${load.loadedRows} dòng)`);
    } catch (error) {
      const isExpected = error instanceof PackageDataError || error instanceof PackageArchiveError || error instanceof CsvFormatError;
      const message = isExpected ? safeMessage(error) : 'Lỗi hệ thống khi kiểm tra gói. Xem log backend.';
      this.logger.error(`Kiểm tra job ${jobId} lỗi: ${safeMessage(error)}`);
      await runner.query(`UPDATE geo.import_jobs SET status = 'failed', error = $2, finished_at = now(), updated_at = now() WHERE id = $1`, [jobId, message]);
      await this.clearStaging(runner, jobId);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  /** Phiên bản của lớp trong bản phát hành hiện hành, để so khác biệt. */
  private async currentBase(runner: QueryRunner, layerCode: string): Promise<BaseVersion | null> {
    const rows = (await runner.query(
      `SELECT v.id, v.row_count FROM map_dataset_versions r
       JOIN geo.layer_versions v ON v.id::text = r.layer_manifest ->> $1
       WHERE r.status = 'published' ORDER BY r.version DESC LIMIT 1`,
      [layerCode],
    )) as Array<{ id: string; row_count: number | null }>;
    return rows[0] ? { id: rows[0].id, rowCount: rows[0].row_count } : null;
  }

  private async loadCoverage(runner: QueryRunner, jobId: string, entries: ArchiveEntry[], packagePath: string, workDir: string, srid: number): Promise<void> {
    const entry = entries.find((item) => item.name === COVERAGE_FILE);
    if (!entry) {
      await runner.query(`INSERT INTO geo_staging.coverages (job_id, geom) VALUES ($1, ST_MakeEnvelope($2, $3, $4, $5, 4326))`, [
        jobId,
        PACKAGE_BBOX.minLng,
        PACKAGE_BBOX.minLat,
        PACKAGE_BBOX.maxLng,
        PACKAGE_BBOX.maxLat,
      ]);
      return;
    }
    if (entry.uncompressedSize > PACKAGE_LIMITS.coverageMaxBytes) throw new PackageDataError('coverage.geojson quá lớn.');
    const path = join(workDir, 'coverage');
    await extractArchiveEntry(packagePath, entry, path);
    const geometries = coverageGeometries(await readFile(path, 'utf8'));
    try {
      await runner.query(
        `INSERT INTO geo_staging.coverages (job_id, geom)
         SELECT $1, ST_Union(ST_MakeValid(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(g), $2), 4326))) FROM unnest($3::text[]) AS g`,
        [jobId, srid, geometries],
      );
    } catch (error) {
      throw new PackageDataError(`coverage.geojson không đọc được: ${safeMessage(error).slice(0, 200)}`);
    }
  }

  // ───────────────────────────── kiểm gói ─────────────────────────────

  private async inspectPackage(packagePath: string, workDir: string): Promise<{ manifest: PackageManifest; entries: ArchiveEntry[] }> {
    const allowed = new Set<string>([MANIFEST_FILE, COVERAGE_FILE, ...Object.values(CONTRACTS).map((spec) => spec.dataFile)]);
    const entries = await readArchiveEntries(packagePath, allowed, PACKAGE_LIMITS);
    const manifestEntry = entries.find((entry) => entry.name === MANIFEST_FILE);
    if (!manifestEntry) throw importError('MANIFEST_INVALID', 'Gói thiếu manifest.json.', HttpStatus.UNPROCESSABLE_ENTITY);
    if (manifestEntry.uncompressedSize > PACKAGE_LIMITS.manifestMaxBytes) {
      throw importError('MANIFEST_INVALID', 'manifest.json quá lớn.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const manifestPath = join(workDir, `manifest-${uuidv7()}.json`);
    await extractArchiveEntry(packagePath, manifestEntry, manifestPath);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch {
      throw importError('MANIFEST_INVALID', 'manifest.json không phải JSON hợp lệ.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const parsed = parseManifest(raw);
    if (!parsed.ok) throw importError('MANIFEST_INVALID', 'manifest.json chưa đúng khuôn.', HttpStatus.UNPROCESSABLE_ENTITY, { errors: parsed.errors });
    const spec = CONTRACTS[parsed.manifest.contract];
    const dataNames = entries.filter((entry) => entry.name !== MANIFEST_FILE && entry.name !== COVERAGE_FILE).map((entry) => entry.name);
    if (dataNames.length !== 1 || dataNames[0] !== spec.dataFile) {
      throw importError('PACKAGE_SHAPE_INVALID', `Khuôn ${parsed.manifest.contract} cần đúng một tệp ${spec.dataFile}.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return { manifest: parsed.manifest, entries };
  }

  private async assertAcceptable(manifest: PackageManifest, sha256: string): Promise<void> {
    const layer = await this.layers.findLayer(manifest.layer).catch(() => null);
    if (!layer) throw importError('LAYER_UNKNOWN', `Chưa có lớp ${manifest.layer}. Tạo lớp trước khi tải gói.`, HttpStatus.UNPROCESSABLE_ENTITY);
    if (layer.usage === 'blocked') throw importError('LAYER_BLOCKED', 'Lớp đang bị chặn (usage = blocked).', HttpStatus.UNPROCESSABLE_ENTITY);
    if (layer.contract !== manifest.contract) {
      throw importError('CONTRACT_MISMATCH', `Lớp ${layer.code} dùng khuôn ${layer.contract}, gói khai ${manifest.contract}.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const duplicate = (await this.dataSource.query(
      `SELECT 1 FROM geo.import_jobs WHERE package_sha256 = $1 AND purpose = 'new' AND status = ANY($2::text[]) LIMIT 1`,
      [sha256, ACTIVE_STATUSES],
    )) as unknown[];
    if (duplicate.length) throw importError('PACKAGE_DUPLICATE', 'Gói này đã được nhập.');
    const label = (await this.dataSource.query(
      `SELECT 1 FROM geo.layer_versions WHERE layer_code = $1 AND label = $2
       UNION ALL
       SELECT 1 FROM geo.import_jobs WHERE layer_code = $1 AND label = $2 AND purpose = 'new' AND status = ANY($3::text[]) LIMIT 1`,
      [manifest.layer, manifest.label, ACTIVE_STATUSES],
    )) as unknown[];
    if (label.length) throw importError('LABEL_EXISTS', `Lớp ${manifest.layer} đã có label ${manifest.label}. Sửa gói thì dùng label mới (ví dụ -r2).`);
  }

  // ───────────────────────────── dọn dẹp ─────────────────────────────

  /** Job dang dở do tiến trình chết giữa chừng: không ai giữ khóa thì chuyển failed. */
  private async recoverInterrupted(): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      if (!(await this.tryLock(runner))) return;
      try {
        const rows = (await runner.query(
          `UPDATE geo.import_jobs SET status = 'failed', error = 'Bị gián đoạn (backend khởi động lại). Tải lại gói.', finished_at = now(), updated_at = now()
           WHERE status IN ('validating', 'saving') RETURNING id`,
        )) as unknown;
        for (const row of rowsOf<{ id: string }>(rows)) await this.clearStaging(runner, row.id);
      } finally {
        await this.unlock(runner);
      }
    } catch (error) {
      this.logger.warn(`Không khôi phục được job dang dở: ${safeMessage(error)}`);
    } finally {
      await runner.release();
    }
  }

  /**
   * Chạy hằng ngày (FR-14): bỏ job validated quá 7 ngày; xóa gói của job bị bỏ/lỗi quá 30 ngày; retired phiên bản lớp
   * không thuộc bản hiện hành, bản liền trước hay bản nháp và đã sẵn sàng quá 30 ngày (gói vẫn giữ trong kho).
   */
  async cleanup(): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      if (!(await this.tryLock(runner))) return;
      try {
        const expired = (await runner.query(
          `UPDATE geo.import_jobs SET status = 'discarded', error = 'Quá ${VALIDATED_EXPIRE_DAYS} ngày không quyết, tự bỏ.', finished_at = now(), updated_at = now()
           WHERE status = 'validated' AND updated_at < now() - interval '${VALIDATED_EXPIRE_DAYS} days' RETURNING id`,
        )) as unknown;
        for (const row of rowsOf<{ id: string }>(expired)) await this.clearStaging(runner, row.id);
        await this.deleteStalePackages(runner);
        await this.retireUnused(runner);
      } finally {
        await this.unlock(runner);
      }
    } catch (error) {
      this.logger.error(`Dọn dữ liệu nền lỗi: ${safeMessage(error)}`);
    } finally {
      await runner.release();
    }
  }

  private async deleteStalePackages(runner: QueryRunner): Promise<void> {
    const rows = (await runner.query(
      `SELECT j.id, j.package_key FROM geo.import_jobs j
       WHERE j.status IN ('rejected', 'discarded', 'failed') AND j.finished_at < now() - interval '${PACKAGE_KEEP_DAYS} days'
         AND j.package_key <> ''
         AND NOT EXISTS (SELECT 1 FROM geo.layer_versions v WHERE v.package_sha256 = j.package_sha256)
         AND NOT EXISTS (SELECT 1 FROM geo.import_jobs o WHERE o.package_key = j.package_key AND o.status NOT IN ('rejected', 'discarded', 'failed'))`,
    )) as Array<{ id: string; package_key: string }>;
    for (const row of rows) {
      try {
        await this.storage.deleteObject(row.package_key);
        await runner.query(`UPDATE geo.import_jobs SET package_key = '' WHERE package_key = $1`, [row.package_key]);
      } catch (error) {
        this.logger.warn(`Không xóa được gói ${row.package_key}: ${safeMessage(error)}`);
      }
    }
  }

  private async retireUnused(runner: QueryRunner): Promise<void> {
    const rows = (await runner.query(
      `WITH kept_releases AS (
         (SELECT version, layer_manifest FROM map_dataset_versions WHERE status = 'published' ORDER BY version DESC LIMIT 2)
         UNION ALL
         SELECT version, layer_manifest FROM map_dataset_versions WHERE status = 'draft'
       ), kept AS (
         SELECT m.value AS id FROM kept_releases r CROSS JOIN LATERAL jsonb_each_text(r.layer_manifest) m
       )
       SELECT v.id, l.geometry_kind FROM geo.layer_versions v JOIN geo.layers l ON l.code = v.layer_code
       WHERE v.status = 'ready' AND v.ready_at < now() - interval '${RETIRE_AFTER_DAYS} days'
         AND v.id::text NOT IN (SELECT id FROM kept)`,
    )) as Array<{ id: string; geometry_kind: GeometryKind }>;
    for (const row of rows) {
      await runner.startTransaction();
      try {
        await runner.query(`SET LOCAL geo.write_mode = 'purge'`);
        await runner.query(`DELETE FROM ${featureTable(row.geometry_kind)} WHERE layer_version_id = $1`, [row.id]);
        await runner.query(`UPDATE geo.layer_versions SET status = 'retired', retired_at = now() WHERE id = $1`, [row.id]);
        await runner.commitTransaction();
        this.logger.log(`Đã dọn phiên bản lớp ${row.id} (retired, gói vẫn trong kho)`);
      } catch (error) {
        await runner.rollbackTransaction();
        this.logger.warn(`Không dọn được phiên bản ${row.id}: ${safeMessage(error)}`);
      }
    }
    if (rows.length > 0) {
      for (const kind of new Set(rows.map((row) => row.geometry_kind))) {
        await runner.query(`VACUUM (ANALYZE) ${featureTable(kind)}`);
      }
    }
  }

  // ───────────────────────────── tiện ích ─────────────────────────────

  private async tryLock(runner: QueryRunner): Promise<boolean> {
    const rows = (await runner.query('SELECT pg_try_advisory_lock($1) AS locked', [IMPORT_LOCK_KEY])) as Array<{ locked: boolean }>;
    return rows[0]?.locked === true;
  }

  private async unlock(runner: QueryRunner): Promise<void> {
    await runner.query('SELECT pg_advisory_unlock($1)', [IMPORT_LOCK_KEY]);
  }

  private async clearStaging(executor: QueryRunner | DataSource, jobId: string): Promise<void> {
    for (const kind of ['point', 'line', 'area', 'grid'] as const) {
      await executor.query(`DELETE FROM ${stagingTable(kind)} WHERE job_id = $1`, [jobId]);
    }
    await executor.query('DELETE FROM geo_staging.coverages WHERE job_id = $1', [jobId]);
  }

  private async findJob(executor: QueryRunner | DataSource, jobId: string): Promise<JobRow> {
    const rows = (await executor.query(`SELECT ${JOB_COLUMNS} FROM geo.import_jobs WHERE id = $1`, [jobId])) as JobRow[];
    if (!rows[0]) throw importError('IMPORT_NOT_FOUND', 'Không có job nhập này.', HttpStatus.NOT_FOUND);
    return rows[0];
  }

  private incomingKey(uploadId: string): string {
    return `datasets/incoming/${uploadId}.zip`;
  }

  private toView(row: JobRow, isDetail: boolean): ImportJobView {
    return {
      id: row.id,
      layerCode: row.layer_code,
      label: row.label,
      contract: row.contract,
      purpose: row.purpose,
      status: row.status,
      packageSha256: row.package_sha256,
      sizeBytes: Number(row.size_bytes),
      manifest: row.manifest,
      checks: row.checks,
      diffSummary: row.diff_summary,
      preview: isDetail ? row.preview : null,
      rowCount: row.row_count,
      error: row.error,
      uploadedBy: row.uploaded_by,
      decidedBy: row.decided_by,
      acceptedWarnings: row.accepted_warnings,
      layerVersionId: row.layer_version_id,
      createdAt: row.created_at.toISOString(),
      finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    };
  }
}

/** Câu chép staging → geo theo dạng hình học (tên bảng cố định). */
function copyFeaturesSql(kind: GeometryKind): string {
  switch (kind) {
    case 'point':
      return `INSERT INTO geo.point_features (layer_version_id, feature_key, category, kind, name, is_planned, attrs, geom)
              SELECT $1, feature_key, category, kind, name, is_planned, attrs, geom::geography
              FROM geo_staging.point_rows WHERE job_id = $2 ORDER BY line_no`;
    case 'line':
      return `INSERT INTO geo.line_features (layer_version_id, feature_key, category, road_class, width_m, name, is_planned, attrs, geom)
              SELECT $1, feature_key, category, road_class, width_m, name, is_planned, attrs,
                     ST_Multi(ST_CollectionExtract(geom, 2))::geography(MultiLineString, 4326)
              FROM geo_staging.line_rows WHERE job_id = $2 ORDER BY line_no`;
    case 'area':
      return `INSERT INTO geo.area_features (layer_version_id, feature_key, category, code, name, valid_from, valid_to, attrs, geom)
              SELECT $1, r.feature_key, r.category, r.code, r.name, r.valid_from, r.valid_to, r.attrs, ST_Multi(piece)
              FROM geo_staging.area_rows r
              CROSS JOIN LATERAL ST_Subdivide(ST_CollectionExtract(ST_MakeValid(r.geom), 3), 256) AS piece
              WHERE r.job_id = $2 AND NOT ST_IsEmpty(piece) ORDER BY r.line_no`;
    case 'grid':
      return `INSERT INTO geo.grid_values (layer_version_id, grid_code, cell_id, value)
              SELECT $1, $3, cell_id, value FROM geo_staging.grid_rows WHERE job_id = $2 ORDER BY cell_id`;
  }
}

/** Lấy danh sách hình học từ coverage.geojson (Geometry, Feature hoặc FeatureCollection đa giác). */
export function coverageGeometries(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PackageDataError('coverage.geojson không phải JSON hợp lệ.');
  }
  const pick = (value: unknown): unknown[] => {
    if (!value || typeof value !== 'object') return [];
    const node = value as { type?: unknown; geometry?: unknown; features?: unknown };
    if (node.type === 'FeatureCollection' && Array.isArray(node.features)) return node.features.flatMap(pick);
    if (node.type === 'Feature') return pick(node.geometry);
    if (node.type === 'Polygon' || node.type === 'MultiPolygon') return [value];
    return [];
  };
  const geometries = pick(parsed);
  if (geometries.length === 0 || geometries.length > 1000) throw new PackageDataError('coverage.geojson cần 1–1000 đa giác.');
  return geometries.map((item) => JSON.stringify(item));
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}

/** `query()` của TypeORM trả `[rows, count]` cho UPDATE … RETURNING trên Postgres, mảng dòng cho SELECT. */
function rowsOf<T>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') return result[0] as T[];
  return result as T[];
}
