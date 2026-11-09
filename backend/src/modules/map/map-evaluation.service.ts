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
import { MapWeightsService } from './map-weights.service.js';
import { MapPlaceResolver, type ResolvedPlace } from './map-place-resolver.service.js';
import { MAP_ANALYSIS_TTL, MAP_REDIS_KEYS } from './map.constants.js';
import { PlaceMeasureService } from './measure/place-measure.service.js';
import {
  CRITERION_IDS,
  buildEvaluation,
  normalizeManualScore,
  type CriterionMeasurement,
  type PlaceEvaluation,
} from './place-evaluation.js';

export type EvaluationSource = 'fresh' | 'shared';

/** Đánh giá kèm thông tin lượt: dùng cho mọi phản hồi đánh giá gửi về client. */
export interface EvaluationView extends PlaceEvaluation {
  /** Địa điểm chuẩn hóa mà điểm bấm được gom vào. */
  placeId: string;
  /** Phiên bản dữ liệu của bản phân tích đang xem. */
  datasetVersion: number;
  currentDatasetVersion: number;
  /** Bản phân tích theo phiên bản dữ liệu cũ hơn hiện hành. */
  outdated: boolean;
  /** fresh: lượt này đo mới; shared: nhận bản phân tích mới nhất đã có của địa điểm. */
  source: EvaluationSource;
  /** Thời điểm người dùng bấm (lượt của họ). */
  evaluatedAt: string;
  /** Thời điểm bản phân tích được tạo (lần gọi AI). */
  analyzedAt: string;
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
  datasetVersion: number;
  createdAt: string;
}

/** Thông điệp chung cho "chưa có lượt đánh giá": không tiết lộ người khác đã đánh giá điểm này hay chưa. */
const NO_RUN_MESSAGE = 'Bạn chưa đánh giá địa điểm này.';

/**
 * Đánh giá địa điểm theo lượt (run) của từng người dùng.
 *
 * - Điểm bấm được gom vào địa điểm chuẩn hóa (MapPlaceResolver), không theo tọa độ thô.
 * - "Đánh giá" (`fresh=false`): địa điểm đã có bản phân tích → nhận bản MỚI NHẤT trong hệ thống (shared);
 *   chưa ai đánh giá → gọi AI (fresh).
 * - "Đánh giá lại" (`fresh=true`): luôn gọi AI, tạo bản phân tích mới; bản này thành bản mới nhất cho người sau.
 * - Mỗi lần bấm là một lượt (tính phí) của chính người bấm. Người dùng chỉ đọc được lượt của mình.
 * - Mở lại địa điểm chỉ đọc lượt gần nhất của mình (GET), không gọi AI.
 */
@Injectable()
export class MapEvaluationService {
  private readonly logger = new Logger(MapEvaluationService.name);

  constructor(
    @InjectRepository(MapPlaceAnalysisEntity) private readonly analyses: Repository<MapPlaceAnalysisEntity>,
    @InjectRepository(MapPlaceEvaluationRunEntity) private readonly runs: Repository<MapPlaceEvaluationRunEntity>,
    @InjectRepository(MapCriterionOverrideEntity) private readonly overrides: Repository<MapCriterionOverrideEntity>,
    private readonly places: MapPlaceResolver,
    private readonly dataset: MapDatasetService,
    private readonly limits: MapLimitsService,
    private readonly redis: RedisService,
    private readonly weights: MapWeightsService,
    private readonly measurer: PlaceMeasureService,
  ) {}

  /** Lượt gần nhất của chính người dùng tại địa điểm chứa điểm bấm; null nếu chưa từng bấm. Không gọi AI. */
  async mine(userId: string, lat: number, lng: number): Promise<{ evaluation: EvaluationView | null; currentDatasetVersion: number }> {
    await this.limits.consumeUser('evaluation-read', userId);
    const current = await this.dataset.current();
    const place = await this.places.find(lat, lng);
    const run = place ? await this.latestRun(userId, place.id) : null;
    if (!run) return { evaluation: null, currentDatasetVersion: current };
    return { evaluation: await this.view(userId, run, current), currentDatasetVersion: current };
  }

  /** Bấm "Đánh giá" (`fresh=false`) hoặc "Đánh giá lại" (`fresh=true`). Luôn tạo một lượt cho người bấm. */
  async run(userId: string, lat: number, lng: number, fresh: boolean): Promise<{ evaluation: EvaluationView; source: EvaluationSource }> {
    await this.limits.consumeUser('evaluate', userId);
    const place = await this.places.resolve(lat, lng);
    const current = await this.dataset.current();
    const { analysis, source } = await this.analysisForRun(place, userId, current, fresh);
    const run = await this.runs.save(
      this.runs.create({
        userId,
        placeId: place.id,
        analysisId: analysis.id,
        datasetVersion: analysis.datasetVersion,
        source,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      }),
    );
    this.logger.log(`Lượt đánh giá ${run.id}: user ${userId}, địa điểm ${place.id}, ${source}`);
    const [overrides, weights] = await Promise.all([this.userOverrides(userId, place.id), this.weights.mapFor(userId)]);
    return { evaluation: this.compose(run, analysis, overrides, current, weights), source };
  }

  /** Bỏ qua tiêu chí và/hoặc đặt điểm tay trên lượt của chính người dùng. Chưa có lượt thì 404. */
  async override(
    userId: string,
    criterionId: string,
    input: { lat: number; lng: number; skipped?: boolean; score?: number | null },
  ): Promise<EvaluationView> {
    await this.limits.consumeUser('evaluate', userId);
    this.assertCriterion(criterionId);
    const run = await this.requireRun(userId, input.lat, input.lng);
    const placeId = run.placeId;
    const existing = await this.overrides.findOne({ where: { userId, placeId, criterionId } });
    const skipped = input.skipped ?? existing?.skipped ?? false;
    const score =
      input.score === undefined ? (existing?.score ?? null) : input.score === null ? null : normalizeManualScore(input.score);
    if (!skipped && score === null) {
      await this.overrides.delete({ userId, placeId, criterionId });
    } else {
      await this.overrides.upsert({ userId, placeId, criterionId, skipped, score }, ['userId', 'placeId', 'criterionId']);
    }
    return this.view(userId, run, await this.dataset.current());
  }

  async resetCriterion(userId: string, criterionId: string, lat: number, lng: number): Promise<EvaluationView> {
    await this.limits.consumeUser('evaluate', userId);
    this.assertCriterion(criterionId);
    const run = await this.requireRun(userId, lat, lng);
    await this.overrides.delete({ userId, placeId: run.placeId, criterionId });
    return this.view(userId, run, await this.dataset.current());
  }

  /** Tóm tắt lượt gần nhất của chính người dùng cho nhiều địa điểm (danh sách "Đã lưu"), theo placeId. */
  async summaries(userId: string, placeIds: string[]): Promise<Map<string, EvaluationSummary>> {
    const result = new Map<string, EvaluationSummary>();
    for (const [placeId, view] of await this.latestViews(userId, placeIds)) {
      result.set(placeId, {
        overall: view.overall,
        rating: view.rating,
        datasetVersion: view.datasetVersion,
        outdated: view.outdated,
        evaluatedAt: view.evaluatedAt,
      });
    }
    return result;
  }

  /**
   * Lượt đánh giá gần nhất của CHÍNH người dùng cho từng địa điểm (đã áp điểm tự chỉnh). Chỉ đọc, không gọi AI.
   * Địa điểm người dùng chưa tự bấm đánh giá thì không có trong kết quả (không lộ bản phân tích của người khác).
   */
  async latestViews(userId: string, placeIds: string[]): Promise<Map<string, EvaluationView>> {
    const result = new Map<string, EvaluationView>();
    if (placeIds.length === 0) return result;
    const runs = await this.runs.find({ where: { userId, placeId: In(placeIds) }, order: { createdAt: 'DESC' } });
    const latest = new Map<string, MapPlaceEvaluationRunEntity>();
    for (const run of runs) if (!latest.has(run.placeId)) latest.set(run.placeId, run);
    if (latest.size === 0) return result;
    const [rows, overrides, current, weights] = await Promise.all([
      this.analyses.find({ where: { id: In([...latest.values()].map((run) => run.analysisId)) } }),
      this.overrides.find({ where: { userId, placeId: In([...latest.keys()]) } }),
      this.dataset.current(),
      this.weights.mapFor(userId),
    ]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const [placeId, run] of latest) {
      const row = byId.get(run.analysisId);
      if (!row) continue;
      result.set(placeId, this.compose(run, toCached(row), overrides.filter((item) => item.placeId === placeId), current, weights));
    }
    return result;
  }


  private assertCriterion(criterionId: string): void {
    if (!CRITERION_IDS.has(criterionId)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'Tiêu chí không tồn tại.', undefined, HttpStatus.NOT_FOUND);
    }
  }

  private latestRun(userId: string, placeId: string): Promise<MapPlaceEvaluationRunEntity | null> {
    return this.runs.findOne({ where: { userId, placeId }, order: { createdAt: 'DESC' } });
  }

  private async requireRun(userId: string, lat: number, lng: number): Promise<MapPlaceEvaluationRunEntity> {
    const place = await this.places.find(lat, lng);
    const run = place ? await this.latestRun(userId, place.id) : null;
    if (!run) throw new BusinessException(ErrorCode.NOT_FOUND, NO_RUN_MESSAGE, undefined, HttpStatus.NOT_FOUND);
    return run;
  }

  private userOverrides(userId: string, placeId: string): Promise<MapCriterionOverrideEntity[]> {
    return this.overrides.find({ where: { userId, placeId } });
  }

  private async view(userId: string, run: MapPlaceEvaluationRunEntity, current: number): Promise<EvaluationView> {
    const [analysis, overrides, weights] = await Promise.all([
      this.analysisById(run.analysisId),
      this.userOverrides(userId, run.placeId),
      this.weights.mapFor(userId),
    ]);
    return this.compose(run, analysis, overrides, current, weights);
  }

  private compose(
    run: MapPlaceEvaluationRunEntity,
    analysis: CachedAnalysis,
    overrides: MapCriterionOverrideEntity[],
    current: number,
    weights: ReadonlyMap<string, number>,
  ): EvaluationView {
    const evaluation = buildEvaluation(
      run.lat,
      run.lng,
      analysis.measurements,
      overrides.map((row) => ({ criterionId: row.criterionId, skipped: row.skipped, score: row.score })),
      analysis.sample,
      weights,
    );
    return {
      ...evaluation,
      placeId: run.placeId,
      datasetVersion: analysis.datasetVersion,
      currentDatasetVersion: current,
      outdated: analysis.datasetVersion < current,
      source: run.source,
      evaluatedAt: run.createdAt.toISOString(),
      analyzedAt: analysis.createdAt,
    };
  }

  /**
   * Chọn bản phân tích cho lượt bấm. Khóa advisory theo địa điểm để nhiều người bấm "Đánh giá" cùng lúc trên
   * một địa điểm chưa có bản nào chỉ gọi AI một lần.
   */
  private async analysisForRun(
    place: ResolvedPlace,
    userId: string,
    version: number,
    fresh: boolean,
  ): Promise<{ analysis: CachedAnalysis; source: EvaluationSource }> {
    return this.analyses.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`map-analysis:${place.id}`]);
      const repo = manager.getRepository(MapPlaceAnalysisEntity);
      if (!fresh) {
        const latest = await repo.findOne({ where: { placeId: place.id }, order: { createdAt: 'DESC' } });
        if (latest) return { analysis: toCached(latest), source: 'shared' as const };
      }
      // Đo tại tọa độ chuẩn của địa điểm để mọi cú bấm trong địa điểm nhất quán. Đo theo bản phát hành đang ghim.
      const measurements = await this.measurer.measure(place.lat, place.lng, version);
      const created = await repo.save(
        repo.create({
          placeId: place.id,
          requestedBy: userId,
          datasetVersion: version,
          lat: place.lat,
          lng: place.lng,
          measurements,
          sample: false,
        }),
      );
      const value = toCached(created);
      await this.writeCache(value);
      return { analysis: value, source: 'fresh' as const };
    });
  }

  private async analysisById(id: string): Promise<CachedAnalysis> {
    const cached = await this.readCache(id);
    if (cached) return cached;
    const row = await this.analyses.findOne({ where: { id } });
    if (!row) {
      this.logger.error(`Thiếu bản phân tích ${id}`);
      throw new BusinessException(ErrorCode.NOT_FOUND, NO_RUN_MESSAGE, undefined, HttpStatus.NOT_FOUND);
    }
    const value = toCached(row);
    await this.writeCache(value);
    return value;
  }

  private async readCache(id: string): Promise<CachedAnalysis | null> {
    try {
      const hit = await this.redis.get<CachedAnalysis>(MAP_REDIS_KEYS.analysis(id));
      return hit && hit.id === id && Array.isArray(hit.measurements) ? hit : null;
    } catch (error) {
      this.logger.warn(`Đọc cache phân tích lỗi: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async writeCache(value: CachedAnalysis): Promise<void> {
    try {
      await this.redis.set(MAP_REDIS_KEYS.analysis(value.id), value, MAP_ANALYSIS_TTL * 1000);
    } catch (error) {
      this.logger.warn(`Ghi cache phân tích lỗi: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function toCached(row: MapPlaceAnalysisEntity): CachedAnalysis {
  return {
    id: row.id,
    measurements: row.measurements,
    sample: row.sample,
    datasetVersion: row.datasetVersion,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}
