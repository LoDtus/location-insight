import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapCriterionWeightEntity } from './entities/map-criterion-weight.entity.js';
import { MapLimitsService } from './map-limits.service.js';
import { CRITERIA, CRITERION_GROUPS, CRITERION_IDS, DEFAULT_WEIGHTS, WEIGHT_MAX, WEIGHT_MIN, isValidWeight } from './place-evaluation.js';

export interface CriterionWeightView {
  id: string;
  label: string;
  group: string;
  groupLabel: string;
  defaultWeight: number;
  weight: number;
  /** Người dùng đã đổi khỏi mặc định. */
  custom: boolean;
}

export interface WeightsView {
  min: number;
  max: number;
  criteria: CriterionWeightView[];
  /** Số tiêu chí đang khác mặc định. */
  changed: number;
}

/** Trọng số tiêu chí của từng người dùng. Chỉ lưu giá trị khác mặc định; đặt về đúng mặc định thì xóa hàng. */
@Injectable()
export class MapWeightsService {
  constructor(
    @InjectRepository(MapCriterionWeightEntity) private readonly weights: Repository<MapCriterionWeightEntity>,
    private readonly limits: MapLimitsService,
  ) {}

  async list(userId: string): Promise<WeightsView> {
    await this.limits.consumeUser('weights', userId);
    return this.view(await this.mapFor(userId));
  }

  async set(userId: string, criterionId: string, weight: number): Promise<WeightsView> {
    await this.limits.consumeUser('weights', userId);
    this.assertCriterion(criterionId);
    if (!isValidWeight(weight)) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, `Trọng số phải là số nguyên từ ${WEIGHT_MIN} đến ${WEIGHT_MAX}.`);
    }
    if (weight === DEFAULT_WEIGHTS[criterionId]) {
      await this.weights.delete({ userId, criterionId });
    } else {
      await this.weights.upsert({ userId, criterionId, weight }, ['userId', 'criterionId']);
    }
    return this.view(await this.mapFor(userId));
  }

  /** Về mặc định một tiêu chí, hoặc tất cả khi không truyền `criterionId`. */
  async reset(userId: string, criterionId?: string): Promise<WeightsView> {
    await this.limits.consumeUser('weights', userId);
    if (criterionId !== undefined) {
      this.assertCriterion(criterionId);
      await this.weights.delete({ userId, criterionId });
    } else {
      await this.weights.delete({ userId });
    }
    return this.view(await this.mapFor(userId));
  }

  /** Trọng số riêng của người dùng (chỉ các tiêu chí đã đổi), dùng khi tính điểm. Không trừ hạn mức. */
  async mapFor(userId: string): Promise<Map<string, number>> {
    const rows = await this.weights.find({ where: { userId } });
    return new Map(rows.filter((row) => CRITERION_IDS.has(row.criterionId) && isValidWeight(row.weight)).map((row) => [row.criterionId, row.weight]));
  }

  private view(custom: Map<string, number>): WeightsView {
    const criteria = CRITERIA.map((item) => {
      const defaultWeight = DEFAULT_WEIGHTS[item.id];
      const weight = custom.get(item.id) ?? defaultWeight;
      return {
        id: item.id,
        label: item.label,
        group: item.group,
        groupLabel: CRITERION_GROUPS[item.group],
        defaultWeight,
        weight,
        custom: weight !== defaultWeight,
      };
    });
    return { min: WEIGHT_MIN, max: WEIGHT_MAX, criteria, changed: criteria.filter((item) => item.custom).length };
  }

  private assertCriterion(criterionId: string): void {
    if (!CRITERION_IDS.has(criterionId)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'Không có tiêu chí này.', undefined, HttpStatus.NOT_FOUND);
    }
  }
}
