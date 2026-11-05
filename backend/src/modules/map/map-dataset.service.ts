import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { MapDatasetVersionEntity } from './entities/map-dataset-version.entity.js';
import { MAP_REDIS_KEYS } from './map.constants.js';
import { cleanText } from './map.mapper.js';

export interface DatasetVersionView {
  version: number;
  note: string;
  releasedBy: string | null;
  releasedAt: string;
  current: boolean;
}

/** Cache phiên bản hiện hành ngắn để admin nâng phiên bản có hiệu lực gần như ngay. */
const CURRENT_TTL_MS = 60_000;
const INITIAL_NOTE = 'Phiên bản khởi tạo: số liệu minh họa theo tiêu chí (chưa có dữ liệu nền thật).';

/**
 * Phiên bản bộ dữ liệu đánh giá. Phiên bản chỉ tăng khi admin chủ động phát hành; lượt đánh giá cũ của
 * người dùng giữ nguyên phiên bản của nó, không tự cập nhật.
 */
@Injectable()
export class MapDatasetService implements OnModuleInit {
  private readonly logger = new Logger(MapDatasetService.name);

  constructor(
    @InjectRepository(MapDatasetVersionEntity) private readonly versions: Repository<MapDatasetVersionEntity>,
    private readonly redis: RedisService,
  ) {}

  /** Bảo đảm luôn có phiên bản 1 để lượt đánh giá đầu tiên có chỗ gắn. */
  async onModuleInit(): Promise<void> {
    try {
      await this.versions
        .createQueryBuilder()
        .insert()
        .values({ version: 1, note: INITIAL_NOTE, releasedBy: null })
        .orIgnore()
        .execute();
    } catch (error) {
      this.logger.warn(`Không khởi tạo được phiên bản dữ liệu: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async current(): Promise<number> {
    try {
      const cached = await this.redis.get<number>(MAP_REDIS_KEYS.datasetCurrent);
      if (typeof cached === 'number' && Number.isInteger(cached) && cached > 0) return cached;
    } catch (error) {
      this.logger.warn(`Đọc phiên bản dữ liệu từ Redis lỗi: ${error instanceof Error ? error.message : String(error)}`);
    }
    const row = await this.versions.createQueryBuilder('v').select('MAX(v.version)', 'max').getRawOne<{ max: number | null }>();
    const value = row?.max ? Number(row.max) : 1;
    try {
      await this.redis.set(MAP_REDIS_KEYS.datasetCurrent, value, CURRENT_TTL_MS);
    } catch {
      // Redis lỗi thì lần sau đọc DB tiếp, không chặn đánh giá.
    }
    return value;
  }

  async list(): Promise<DatasetVersionView[]> {
    const rows = await this.versions.find({ order: { version: 'DESC' }, take: 100 });
    const top = rows[0]?.version ?? 1;
    return rows.map((row) => ({
      version: row.version,
      note: row.note,
      releasedBy: row.releasedBy,
      releasedAt: row.releasedAt.toISOString(),
      current: row.version === top,
    }));
  }

  /** Admin phát hành phiên bản mới = hiện hành + 1. Lượt đánh giá cũ không đổi; người dùng tự bấm "Đánh giá lại". */
  async release(adminId: string, note: string): Promise<DatasetVersionView> {
    const clean = cleanText(note, 500);
    if (clean.length < 3) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Ghi chú phát hành cần ít nhất 3 ký tự.');
    }
    const saved = await this.versions.manager.transaction(async (manager) => {
      const repo = manager.getRepository(MapDatasetVersionEntity);
      // Khóa bảng ngắn để hai admin bấm cùng lúc không tạo trùng số.
      await manager.query('LOCK TABLE map_dataset_versions IN SHARE ROW EXCLUSIVE MODE');
      const row = await repo.createQueryBuilder('v').select('MAX(v.version)', 'max').getRawOne<{ max: number | null }>();
      const next = (row?.max ? Number(row.max) : 0) + 1;
      return repo.save(repo.create({ version: next, note: clean, releasedBy: adminId, releasedAt: new Date() }));
    });
    try {
      await this.redis.del(MAP_REDIS_KEYS.datasetCurrent);
    } catch (error) {
      this.logger.warn(`Xóa cache phiên bản dữ liệu lỗi: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.logger.log(`Admin ${adminId} phát hành phiên bản dữ liệu ${saved.version}`);
    return { version: saved.version, note: saved.note, releasedBy: saved.releasedBy, releasedAt: saved.releasedAt.toISOString(), current: true };
  }
}
