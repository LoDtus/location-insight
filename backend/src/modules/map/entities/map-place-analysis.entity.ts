import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { CriterionMeasurement } from '../place-evaluation.js';

/**
 * Một lần hệ thống thực sự gọi AI/phân tích cho một địa điểm: khi địa điểm chưa từng được đánh giá, hoặc khi có
 * người bấm "Đánh giá lại". Bản mới nhất của địa điểm là thứ người bấm "Đánh giá" lần đầu nhận được.
 * KHÔNG bao giờ trả trực tiếp cho người dùng: người dùng chỉ xem qua lượt (run) của chính mình.
 */
@Entity('map_place_analyses')
@Index('idx_map_place_analyses_place_created', ['placeId', 'createdAt'])
export class MapPlaceAnalysisEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'place_id' })
  placeId: string;

  /** Người bấm gây ra lần phân tích này (để đối soát chi phí AI). */
  @Column({ type: 'uuid', name: 'requested_by' })
  requestedBy: string;

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
