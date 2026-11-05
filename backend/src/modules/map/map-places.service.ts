import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapCriterionOverrideEntity } from './entities/map-criterion-override.entity.js';
import { MapSavedPlaceEntity } from './entities/map-saved-place.entity.js';
import { MapLimitsService } from './map-limits.service.js';
import {
  MAP_EVALUATION_TTL,
  MAP_REDIS_KEYS,
  MAP_SAVED_MAX,
  type MapPlaceKind,
} from './map.constants.js';
import { cleanText } from './map.mapper.js';
import {
  CRITERION_IDS,
  buildEvaluation,
  generateCriteria,
  normalizeManualScore,
  placeKeyOf,
  type CriterionMeasurement,
  type PlaceEvaluation,
} from './place-evaluation.js';

export interface SavedPlaceView {
  id: string;
  placeKey: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  kind: string | null;
  createdAt: string;
}

function toView(row: MapSavedPlaceEntity): SavedPlaceView {
  return {
    id: row.id,
    placeKey: row.placeKey,
    lat: row.lat,
    lng: row.lng,
    name: row.name,
    address: row.address,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Địa điểm đã lưu và đánh giá địa điểm (mock theo tiêu chí; sau này thay bằng AI/PostGIS). */
@Injectable()
export class MapPlacesService {
  private readonly logger = new Logger(MapPlacesService.name);

  constructor(
    @InjectRepository(MapSavedPlaceEntity) private readonly saved: Repository<MapSavedPlaceEntity>,
    @InjectRepository(MapCriterionOverrideEntity) private readonly overrides: Repository<MapCriterionOverrideEntity>,
    private readonly limits: MapLimitsService,
    private readonly redis: RedisService,
  ) {}

  async listSaved(userId: string): Promise<SavedPlaceView[]> {
    await this.limits.consumeUser('saved', userId);
    const rows = await this.saved.find({ where: { userId }, order: { createdAt: 'DESC' }, take: MAP_SAVED_MAX });
    return rows.map(toView);
  }

  /** Lưu (idempotent theo tọa độ): đã lưu rồi thì trả lại bản cũ. */
  async save(
    userId: string,
    input: { lat: number; lng: number; name: string; address?: string; kind?: MapPlaceKind },
  ): Promise<SavedPlaceView> {
    await this.limits.consumeUser('saved', userId);
    const placeKey = placeKeyOf(input.lat, input.lng);
    const existing = await this.saved.findOne({ where: { userId, placeKey } });
    if (existing) return toView(existing);
    const count = await this.saved.count({ where: { userId } });
    if (count >= MAP_SAVED_MAX) {
      throw new BusinessException(
        ErrorCode.LIMIT_REACHED,
        `Bạn đã lưu tối đa ${MAP_SAVED_MAX} địa điểm. Xóa bớt rồi lưu tiếp.`,
        { max: MAP_SAVED_MAX },
        HttpStatus.CONFLICT,
      );
    }
    const name = cleanText(input.name, 200);
    if (!name) throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Tên địa điểm không hợp lệ.');
    const row = this.saved.create({
      userId,
      placeKey,
      lat: Number(input.lat.toFixed(6)),
      lng: Number(input.lng.toFixed(6)),
      name,
      address: cleanText(input.address ?? '', 300),
      kind: input.kind ?? null,
    });
    try {
      return toView(await this.saved.save(row));
    } catch {
      // Hai yêu cầu lưu cùng lúc: hàng kia đã thắng ràng buộc unique.
      const raced = await this.saved.findOne({ where: { userId, placeKey } });
      if (raced) return toView(raced);
      throw new BusinessException(ErrorCode.CONFLICT, 'Không lưu được địa điểm, vui lòng thử lại.');
    }
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.limits.consumeUser('saved', userId);
    const result = await this.saved.delete({ id, userId });
    if (!result.affected) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'Không tìm thấy địa điểm đã lưu.', undefined, HttpStatus.NOT_FOUND);
    }
    return { id };
  }

  async evaluate(userId: string, lat: number, lng: number): Promise<PlaceEvaluation> {
    await this.limits.consumeUser('evaluate', userId);
    return this.compose(userId, lat, lng);
  }

  /** Bỏ qua tiêu chí và/hoặc đặt điểm tay. Trả về đánh giá đã tính lại. */
  async override(
    userId: string,
    criterionId: string,
    input: { lat: number; lng: number; skipped?: boolean; score?: number | null },
  ): Promise<PlaceEvaluation> {
    await this.limits.consumeUser('evaluate', userId);
    this.assertCriterion(criterionId);
    const placeKey = placeKeyOf(input.lat, input.lng);
    const current = await this.overrides.findOne({ where: { userId, placeKey, criterionId } });
    const skipped = input.skipped ?? current?.skipped ?? false;
    const score =
      input.score === undefined ? (current?.score ?? null) : input.score === null ? null : normalizeManualScore(input.score);
    if (!skipped && score === null) {
      await this.overrides.delete({ userId, placeKey, criterionId });
    } else {
      await this.overrides.upsert({ userId, placeKey, criterionId, skipped, score }, ['userId', 'placeKey', 'criterionId']);
    }
    return this.compose(userId, input.lat, input.lng);
  }

  /** Khôi phục tiêu chí về mặc định (không bỏ qua, điểm tự động). */
  async resetCriterion(userId: string, criterionId: string, lat: number, lng: number): Promise<PlaceEvaluation> {
    await this.limits.consumeUser('evaluate', userId);
    this.assertCriterion(criterionId);
    await this.overrides.delete({ userId, placeKey: placeKeyOf(lat, lng), criterionId });
    return this.compose(userId, lat, lng);
  }

  private assertCriterion(criterionId: string): void {
    if (!CRITERION_IDS.has(criterionId)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'Tiêu chí không tồn tại.', undefined, HttpStatus.NOT_FOUND);
    }
  }

  private async compose(userId: string, lat: number, lng: number): Promise<PlaceEvaluation> {
    const placeKey = placeKeyOf(lat, lng);
    const [measurements, rows] = await Promise.all([
      this.measurements(placeKey, lat, lng),
      this.overrides.find({ where: { userId, placeKey } }),
    ]);
    return buildEvaluation(
      lat,
      lng,
      measurements,
      rows.map((row) => ({ criterionId: row.criterionId, skipped: row.skipped, score: row.score })),
    );
  }

  /** Số đo tự động dùng chung cho mọi người, cache Redis theo khóa tọa độ. Redis lỗi thì tính trực tiếp. */
  private async measurements(placeKey: string, lat: number, lng: number): Promise<CriterionMeasurement[]> {
    const key = MAP_REDIS_KEYS.evaluation(placeKey);
    try {
      const hit = await this.redis.get<CriterionMeasurement[]>(key);
      if (Array.isArray(hit) && hit.length > 0) return hit;
    } catch (error) {
      this.logger.warn(`Đọc cache đánh giá lỗi: ${error instanceof Error ? error.message : String(error)}`);
    }
    const fresh = generateCriteria(lat, lng);
    try {
      await this.redis.set(key, fresh, MAP_EVALUATION_TTL * 1000);
    } catch (error) {
      this.logger.warn(`Ghi cache đánh giá lỗi: ${error instanceof Error ? error.message : String(error)}`);
    }
    return fresh;
  }
}
