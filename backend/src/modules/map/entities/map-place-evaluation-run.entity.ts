import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Một lần người dùng bấm "Đánh giá địa điểm" / "Đánh giá lại" (lượt tính phí). Người dùng chỉ thấy lượt của
 * chính mình; lượt mới nhất theo (user, place) là thứ hiển thị khi mở lại địa điểm.
 */
@Entity('map_place_evaluation_runs')
@Index('idx_map_eval_runs_user_place_created', ['userId', 'placeKey', 'createdAt'])
export class MapPlaceEvaluationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 32, name: 'place_key' })
  placeKey: string;

  @Column({ type: 'uuid', name: 'analysis_id' })
  analysisId: string;

  @Column({ type: 'integer', name: 'dataset_version' })
  datasetVersion: number;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
