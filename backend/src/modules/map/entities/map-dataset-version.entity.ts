import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Phiên bản bộ dữ liệu dùng để đánh giá địa điểm. Chỉ admin nâng phiên bản (khi đã cập nhật dữ liệu nền
 * và phát hành dataset mới). Phiên bản hiện hành = số lớn nhất.
 */
@Entity('map_dataset_versions')
export class MapDatasetVersionEntity {
  @PrimaryColumn({ type: 'integer' })
  version: number;

  @Column({ type: 'varchar', length: 500, default: '' })
  note: string;

  /** Admin phát hành; null với phiên bản khởi tạo của hệ thống. */
  @Column({ type: 'uuid', name: 'released_by', nullable: true })
  releasedBy: string | null;

  @Column({ type: 'timestamptz', name: 'released_at', default: () => 'now()' })
  releasedAt: Date;
}
