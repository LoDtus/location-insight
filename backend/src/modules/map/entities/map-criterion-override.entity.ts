import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Chỉnh tay của một người cho một tiêu chí tại một địa điểm: bỏ qua tiêu chí và/hoặc tự đặt điểm.
 * Khôi phục về mặc định thì xóa hàng.
 */
@Entity('map_criterion_overrides')
export class MapCriterionOverrideEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 32, name: 'place_key' })
  placeKey: string;

  @PrimaryColumn({ type: 'varchar', length: 32, name: 'criterion_id' })
  criterionId: string;

  @Column({ type: 'boolean', default: false })
  skipped: boolean;

  /** Điểm tự đặt 0–10 (bước 0,5); null = dùng điểm tự động. */
  @Column({ type: 'real', nullable: true })
  score: number | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
