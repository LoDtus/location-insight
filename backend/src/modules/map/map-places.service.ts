import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, type Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapSavedPlaceEntity } from './entities/map-saved-place.entity.js';
import { MapLimitsService } from './map-limits.service.js';
import { MapEvaluationService, type EvaluationSummary, type EvaluationView } from './map-evaluation.service.js';
import { MAP_COMPARE_MAX, MAP_LABEL_MAX, MAP_NOTE_MAX, MAP_SAVED_MAX, type MapPlaceKind } from './map.constants.js';
import { cleanText } from './map.mapper.js';
import { MapPlaceResolver } from './map-place-resolver.service.js';

export interface SavedPlaceView {
  id: string;
  /** Địa điểm chuẩn hóa (map_places). */
  placeId: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  kind: string | null;
  /** Tên gợi nhớ người dùng tự đặt; null = dùng `name`. */
  label: string | null;
  note: string;
  /** Đang nằm trong danh sách so sánh. */
  compared: boolean;
  createdAt: string;
  /** Lượt đánh giá gần nhất của CHÍNH người dùng tại địa điểm này; null nếu chưa đánh giá. */
  evaluation: EvaluationSummary | null;
}

function toView(row: MapSavedPlaceEntity, evaluation: EvaluationSummary | null = null): SavedPlaceView {
  return {
    id: row.id,
    placeId: row.placeId,
    lat: row.lat,
    lng: row.lng,
    name: row.name,
    address: row.address,
    kind: row.kind,
    label: row.label ?? null,
    note: row.note ?? '',
    compared: row.comparedAt != null,
    createdAt: row.createdAt.toISOString(),
    evaluation,
  };
}

/** Một cột của bảng so sánh: mục đã lưu kèm lượt đánh giá gần nhất của chính người dùng (null nếu chưa đánh giá). */
export interface CompareItemView extends Omit<SavedPlaceView, 'evaluation'> {
  evaluation: EvaluationView | null;
}

/** Ghi chú nhiều dòng: bỏ ký tự điều khiển (trừ xuống dòng), tối đa 2 dòng trống liền nhau, cắt độ dài. */
export function cleanNote(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAP_NOTE_MAX);
}

/** Địa điểm đã lưu của người dùng (kèm tóm tắt đánh giá của chính họ). */
@Injectable()
export class MapPlacesService {
  constructor(
    @InjectRepository(MapSavedPlaceEntity) private readonly saved: Repository<MapSavedPlaceEntity>,
    private readonly evaluations: MapEvaluationService,
    private readonly resolver: MapPlaceResolver,
    private readonly limits: MapLimitsService,
  ) {}

  async listSaved(userId: string): Promise<SavedPlaceView[]> {
    await this.limits.consumeUser('saved', userId);
    const rows = await this.saved.find({ where: { userId }, order: { createdAt: 'DESC' }, take: MAP_SAVED_MAX });
    const summaries = await this.evaluations.summaries(userId, rows.map((row) => row.placeId));
    return rows.map((row) => toView(row, summaries.get(row.placeId) ?? null));
  }

  /** Lưu (idempotent theo địa điểm chuẩn hóa: bấm lệch vài mét vẫn là một mục). Đã lưu rồi thì trả lại bản cũ. */
  async save(
    userId: string,
    input: { lat: number; lng: number; name: string; address?: string; kind?: MapPlaceKind },
  ): Promise<SavedPlaceView> {
    await this.limits.consumeUser('saved', userId);
    const place = await this.resolver.resolve(input.lat, input.lng);
    const placeId = place.id;
    const existing = await this.saved.findOne({ where: { userId, placeId } });
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
      placeId,
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
      const raced = await this.saved.findOne({ where: { userId, placeId } });
      if (raced) return toView(raced);
      throw new BusinessException(ErrorCode.CONFLICT, 'Không lưu được địa điểm, vui lòng thử lại.');
    }
  }

  /** Đặt tên gợi nhớ / ghi chú / bật-tắt so sánh. Chỉ sửa được mục của chính mình (không thì 404). */
  async update(
    userId: string,
    id: string,
    patch: { label?: string | null; note?: string; compared?: boolean },
  ): Promise<SavedPlaceView> {
    await this.limits.consumeUser('saved', userId);
    const row = await this.saved.findOne({ where: { id, userId } });
    if (!row) throw this.notFound();
    if (patch.label !== undefined) {
      const label = patch.label === null ? '' : cleanText(patch.label, MAP_LABEL_MAX);
      row.label = label ? label : null;
    }
    if (patch.note !== undefined) row.note = cleanNote(patch.note);
    if (patch.compared !== undefined && patch.compared !== (row.comparedAt != null)) {
      if (patch.compared) {
        const count = await this.saved.count({ where: { userId, comparedAt: Not(IsNull()) } });
        if (count >= MAP_COMPARE_MAX) {
          throw new BusinessException(
            ErrorCode.LIMIT_REACHED,
            `Chỉ so sánh tối đa ${MAP_COMPARE_MAX} địa điểm cùng lúc. Bỏ bớt rồi thêm tiếp.`,
            { max: MAP_COMPARE_MAX },
            HttpStatus.CONFLICT,
          );
        }
        row.comparedAt = new Date();
      } else {
        row.comparedAt = null;
      }
    }
    const saved = await this.saved.save(row);
    const summary = (await this.evaluations.summaries(userId, [saved.placeId])).get(saved.placeId) ?? null;
    return toView(saved, summary);
  }

  /** Danh sách so sánh (theo thứ tự thêm vào), mỗi mục kèm đánh giá đầy đủ của chính người dùng. */
  async compare(userId: string): Promise<CompareItemView[]> {
    await this.limits.consumeUser('saved', userId);
    const rows = await this.saved.find({
      where: { userId, comparedAt: Not(IsNull()) },
      order: { comparedAt: 'ASC' },
      take: MAP_COMPARE_MAX,
    });
    const views = await this.evaluations.latestViews(userId, rows.map((row) => row.placeId));
    return rows.map((row) => ({ ...toView(row), evaluation: views.get(row.placeId) ?? null }));
  }

  private notFound(): BusinessException {
    return new BusinessException(ErrorCode.NOT_FOUND, 'Không tìm thấy địa điểm đã lưu.', undefined, HttpStatus.NOT_FOUND);
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
