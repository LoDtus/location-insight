import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapSavedPlaceEntity } from './entities/map-saved-place.entity.js';
import { MapLimitsService } from './map-limits.service.js';
import { MapEvaluationService, type EvaluationSummary } from './map-evaluation.service.js';
import { MAP_SAVED_MAX, type MapPlaceKind } from './map.constants.js';
import { cleanText } from './map.mapper.js';
import { placeKeyOf } from './place-evaluation.js';

export interface SavedPlaceView {
  id: string;
  placeKey: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  kind: string | null;
  createdAt: string;
  /** Lượt đánh giá gần nhất của CHÍNH người dùng tại địa điểm này; null nếu chưa đánh giá. */
  evaluation: EvaluationSummary | null;
}

function toView(row: MapSavedPlaceEntity, evaluation: EvaluationSummary | null = null): SavedPlaceView {
  return {
    id: row.id,
    placeKey: row.placeKey,
    lat: row.lat,
    lng: row.lng,
    name: row.name,
    address: row.address,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
    evaluation,
  };
}

/** Địa điểm đã lưu của người dùng (kèm tóm tắt đánh giá của chính họ). */
@Injectable()
export class MapPlacesService {
  constructor(
    @InjectRepository(MapSavedPlaceEntity) private readonly saved: Repository<MapSavedPlaceEntity>,
    private readonly evaluations: MapEvaluationService,
    private readonly limits: MapLimitsService,
  ) {}

  async listSaved(userId: string): Promise<SavedPlaceView[]> {
    await this.limits.consumeUser('saved', userId);
    const rows = await this.saved.find({ where: { userId }, order: { createdAt: 'DESC' }, take: MAP_SAVED_MAX });
    const summaries = await this.evaluations.summaries(userId, rows.map((row) => row.placeKey));
    return rows.map((row) => toView(row, summaries.get(row.placeKey) ?? null));
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
}
