import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapCriterionOverrideEntity } from './entities/map-criterion-override.entity.js';
import { MapPlaceAnalysisEntity } from './entities/map-place-analysis.entity.js';
import { MapPlaceEvaluationRunEntity } from './entities/map-place-evaluation-run.entity.js';
import { MapDatasetService } from './map-dataset.service.js';
import { MapLimitsService } from './map-limits.service.js';
import { MAP_ANALYSIS_TTL, MAP_REDIS_KEYS } from './map.constants.js';
import {
  CRITERION_IDS,
  buildEvaluation,
  generateCriteria,
  normalizeManualScore,
  placeKeyOf,
  type CriterionMeasurement,
  type PlaceEvaluation,
} from './place-evaluation.js';

/** Đánh giá kèm thông tin phiên bản: dùng cho mọi phản hồi đánh giá gửi về client. */
export interface EvaluationView extends PlaceEvaluation {
  /** Phiên bản dữ liệu của lượt đánh giá đang xem. */
  datasetVersion: number;
  /** Phiên bản dữ liệu hiện hành của hệ thống. */
  currentDatasetVersion: number;
  /** true khi đã có phiên bản dữ liệu mới hơn: người dùng có thể bấm "Đánh giá lại". */
  outdated: boolean;
  evaluatedAt: string;
}

export interface EvaluationSummary {
  overall: number | null;
  rating: string;
  datasetVersion: number;
  outdated: boolean;
  evaluatedAt: string;
}

interface CachedAnalysis {
  id: string;
  measurements: CriterionMeasurement[];
  sample: boolean;
}

/** Thông điệp chung cho "chưa có lượt đánh giá": không tiết lộ người khác đã đánh giá điểm này hay chưa. */
const NO_RUN_MESSAGE = 'Bạn chưa đánh giá địa điểm này.';

/**
 * Đánh giá địa điểm theo lượt (run) của từng người dùng.
 *
 * - Mỗi lần bấm "Đánh giá" / "Đánh giá lại" tạo một lượt (tính phí) gắn với phiên bản dữ liệu hiện hành.
 * - Lượt đầu tiên của một phiên bản tạo bản phân tích dùng chung (DB); lượt sau cùng phiên bản dùng lại nó.
 * - Người dùng chỉ đọc được lượt của chính mình. Người khác phải tự bấm, kể cả khi bản phân tích đã có sẵn.
 * - Mở lại địa điểm chỉ đọc lượt gần nhất (GET), không tính toán, không tự đánh giá lại khi có phiên bản mới.
 */
@Injectable()
export class MapEvaluationService {
  private readonly logger = new Logger(MapEvaluationService.name);

  constructor(
    @InjectRepository(MapPlaceAnalysisEntity) private readonly analyses: Repository<MapPlaceAnalysisEntity>,
    @InjectRepository(MapPlaceEvaluationRunEntity) private readonly runs: Repository<MapPlaceEvaluationRunEntity>,
    @InjectRepository(MapCriterionOverrideEntity) private readonly overrides: Repository<MapCriterionOverrideEntity>,
    private readonly dataset: MapDatasetService,
    private readonly limits: MapLimitsService,
    private readonly redis: RedisService,
  ) {}

  /** Lượt gần nhất của chính người dùng tại điểm này; null nếu chưa từng bấm. Không tính phí. */
  async mine(userId: string, lat: number, lng: number): Promise<{ evaluation: EvaluationView | null; currentDatasetVersion: number }> {
    await this.limits.consumeUser('evaluation-read', userId);
    const current = await this.dataset.current();
    const run = await this.latestRun(userId, placeKeyOf(lat, lng));
    if (!run) return { evaluation: null, currentDatasetVersion: current };
    return { evaluation: await this.view(userId, run, current), currentDatasetVersion: current };
  }

  /**
   * Bấm "Đánh giá" / "Đánh giá lại". Nếu lượt gần nhất của người dùng đã ở phiên bản hiện hành thì trả lại lượt đó
   * (`charged: false`, không tạo lượt mới); ngược lại tạo lượt mới ở phiên bản hiện hành (`charged: true`).
   */
  async run(userId: string, lat: number, lng: number): Promise<{ evaluation: EvaluationView; charged: boolean }> {
    await this.limits.consumeUser('evaluate', userId);
    const placeKey = placeKeyOf(lat, lng);
    const current = await this.dataset.current();
    const latest = await this.latestRun(userId, placeKey);
    if (latest && latest.datasetVersion >= current) {
      return { evaluation: await this.view(userId, latest, current), charged: false };
    }
    const analysis = await this.analysisFor(placeKey, current, lat, lng);
    const run = await this.runs.save(
      this.runs.create({
        userId,
        placeKey,
        analysisId: analysis.id,
        datasetVersion: current,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      }),
    );
    this.logger.log(`Lượt đánh giá ${run.id}: user ${userId}, phiên bản ${current}`);
    return { evaluation: this.compose(run, analysis, await this.userOverrides(userId, placeKey), current), charged: true };
  }

  /** Bỏ qua tiêu chí và/hoặc đặt điểm tay trên lượt của chính người dùng. Chưa có lượt thì 404. */
  async override(
    userId: string,
    criterionId: string,
    input: { lat: number; lng: number; skipped?: boolean; score?: number | null },
  ): Promise<EvaluationView> {
    await this.limits.consumeUser('evaluate', userId);
    this.assertCriterion(criterionId);
    const placeKey = placeKeyOf(input.lat, input.lng);
    const run = await this.requireRun(userId, placeKey);
    const current = await this.overrides.findOne({ where: { userId, placeKey, criterionId } });
    const skipped = input.skipped ?? current?.skipped ?? false;
    const score =
      input.score === undefined ? (current?.score ?? null) : input.score === null ? null : normalizeManualScore(input.score);
    if (!skipped && score === null) {
      await this.overrides.delete({ userId, placeKey, criterionId });
    } else {
      await this.overrides.upsert({ userId, placeKey, criterionId, skipped, score }, ['userId', 'placeKey', 'criterionId']);
    }
    return this.view(userId, run, await this.dataset.current());
  }

  async resetCriterion(userId: string, criterionId: string, lat: number, lng: number): Promise<EvaluationView> {
    await this.limits.consumeUser('evaluate', userId);
    this.assertCriterion(criterionId);
    const placeKey = placeKeyOf(lat, lng);
    const run = await this.requireRun(userId, placeKey);
    await this.overrides.delete({ userId, placeKey, criterionId });
    return this.view(userId, run, await this.dataset.current());
  }

  /** Tóm tắt lượt gần nhất của chính người dùng cho nhiều địa điểm (danh sách "Đã lưu"). */
  async summaries(userId: string, placeKeys: string[]): Promise<Map<string, EvaluationSummary>> {
    const result = new Map<string, EvaluationSummary>();
    if (placeKeys.length === 0) return result;
    const runs = await this.runs.find({ where: { userId, placeKey: In(placeKeys) }, order: { createdAt: 'DESC' } });
    const latest = new Map<string, MapPlaceEvaluationRunEntity>();
    for (const run of runs) if (!latest.has(run.placeKey)) latest.set(run.placeKey, run);
    if (latest.size === 0) return result;
    const [analyses, overrides, current] = await Promise.all([
      this.analyses.find({ where: { id: In([...latest.values()].map((run) => run.analysisId)) } }),
      this.overrides.find({ where: { userId, placeKey: In([...latest.keys()]) } }),
      this.dataset.current(),
    ]);
    const analysisById = new Map(analyses.map((item) => [item.id, item]));
    for (const [placeKey, run] of latest) {
      const analysis = analysisById.get(run.analysisId);
      if (!analysis) continue;
      const view = this.compose(
        run,
        { id: analysis.id, measurements: analysis.measurements, sample: analysis.sample },
        overrides.filter((item) => item.placeKey === placeKey),
        current,
      );
      result.set(placeKey, {
        overall: view.overall,
        rating: view.rating,
        datasetVersion: view.datasetVersion,
        outdated: view.outdated,
        evaluatedAt: view.evaluatedAt,
      });
    }
    return result;
  }

  private assertCriterion(criterionId: string): void {
    if (!CRITERION_IDS.has(criterionId)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'Tiêu chí không tồn tại.', undefined, HttpStatus.NOT_FOUND);
    }
  }

  private latestRun(userId: string, placeKey: string): Promise<MapPlaceEvaluationRunEntity | null> {
    return this.runs.findOne({ where: { userId, placeKey }, order: { createdAt: 'DESC' } });
  }

  private async requireRun(userId: string, placeKey: string): Promise<MapPlaceEvaluationRunEntity> {
    const run = await this.latestRun(userId, placeKey);
    if (!run) throw new BusinessException(ErrorCode.NOT_FOUND, NO_RUN_MESSAGE, undefined, HttpStatus.NOT_FOUND);
    return run;
  }

  private userOverrides(userId: string, placeKey: string): Promise<MapCriterionOverrideEntity[]> {
    return this.overrides.find({ where: { userId, placeKey } });
  }

  private async view(userId: string, run: MapPlaceEvaluationRunEntity, current: number): Promise<EvaluationView> {
    const [analysis, overrides] = await Promise.all([this.analysisById(run), this.userOverrides(userId, run.placeKey)]);
    return this.compose(run, analysis, overrides, current);
  }

  private compose(
    run: MapPlaceEvaluationRunEntity,
    analysis: CachedAnalysis,
    overrides: MapCriterionOverrideEntity[],
    current: number,
  ): EvaluationView {
    const evaluation = buildEvaluation(
      run.lat,
      run.lng,
      analysis.measurements,
      overrides.map((row) => ({ criterionId: row.criterionId, skipped: row.skipped, score: row.score })),
      analysis.sample,
    );
    return {
      ...evaluation,
      datasetVersion: run.datasetVersion,
      currentDatasetVersion: current,
      outdated: run.datasetVersion < current,
      evaluatedAt: run.createdAt.toISOString(),
    };
  }

  /** Bản phân tích của một lượt (theo id, đúng phiên bản của lượt đó). */
  private async analysisById(run: MapPlaceEvaluationRunEntity): Promise<CachedAnalysis> {
    const cached = await this.readCache(MAP_REDIS_KEYS.analysis(run.datasetVersion, run.placeKey));
    if (cached && cached.id === run.analysisId) return cached;
    const row = await this.analyses.findOne({ where: { id: run.analysisId } });
    if (!row) {
      // Không xảy ra nếu dữ liệu toàn vẹn; báo lỗi chung, chi tiết chỉ ghi log.
      this.logger.error(`Thiếu bản phân tích ${run.analysisId} của lượt ${run.id}`);
      throw new BusinessException(ErrorCode.NOT_FOUND, NO_RUN_MESSAGE, undefined, HttpStatus.NOT_FOUND);
    }
    const value = { id: row.id, measurements: row.measurements, sample: row.sample };
    await this.writeCache(MAP_REDIS_KEYS.analysis(row.datasetVersion, row.placeKey), value);
    return value;
  }

  /** Bản phân tích dùng chung của (tọa độ, phiên bản): đọc cache/DB, chưa có thì tính và lưu (chống trùng khi đua). */
  private async analysisFor(placeKey: string, version: number, lat: number, lng: number): Promise<CachedAnalysis> {
    const key = MAP_REDIS_KEYS.analysis(version, placeKey);
    const cached = await this.readCache(key);
    if (cached) return cached;
    let row = await this.analyses.findOne({ where: { placeKey, datasetVersion: version } });
    if (!row) {
      // Sau này: chỗ gọi AI/PostGIS thật. Hiện là số đo minh họa ổn định theo tọa độ.
      const measurements = generateCriteria(lat, lng);
      await this.analyses
        .createQueryBuilder()
        .insert()
        .values({ placeKey, datasetVersion: version, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), measurements, sample: true })
        .orIgnore()
        .execute();
      row = await this.analyses.findOne({ where: { placeKey, datasetVersion: version } });
    }
    if (!row) throw new BusinessException(ErrorCode.CONFLICT, 'Không tạo được bản đánh giá, vui lòng thử lại.');
    const value = { id: row.id, measurements: row.measurements, sample: row.sample };
    await this.writeCache(key, value);
    return value;
  }

  private async readCache(key: string): Promise<CachedAnalysis | null> {
    try {
      const hit = await this.redis.get<CachedAnalysis>(key);
      return hit && typeof hit.id === 'string' && Array.isArray(hit.measurements) ? hit : null;
    } catch (error) {
      this.logger.warn(`Đọc cache phân tích lỗi: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async writeCache(key: string, value: CachedAnalysis): Promise<void> {
    try {
      await this.redis.set(key, value, MAP_ANALYSIS_TTL * 1000);
    } catch (error) {
      this.logger.warn(`Ghi cache phân tích lỗi: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
