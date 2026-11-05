import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { CriterionMeasurement } from '../place-evaluation.js';

/**
 * Kết quả phân tích một tọa độ theo một phiên bản dữ liệu. Tạo bởi lượt đánh giá đầu tiên của phiên bản đó,
 * các lượt sau (của bất kỳ ai, cùng phiên bản) dùng lại. KHÔNG bao giờ trả trực tiếp cho người dùng:
 * người dùng chỉ xem qua lượt đánh giá (run) của chính mình.
 */
@Entity('map_place_analyses')
@Index('uq_map_place_analyses_key_version', ['placeKey', 'datasetVersion'], { unique: true })
export class MapPlaceAnalysisEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, name: 'place_key' })
  placeKey: string;

  @Column({ type: 'integer', name: 'dataset_version' })
  datasetVersion: number;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'jsonb' })
  measurements: CriterionMeasurement[];

  /** true: số liệu minh họa (chưa có dữ liệu nền/AI thật). */
  @Column({ type: 'boolean', default: true })
  sample: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
