import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Trọng số riêng của người dùng cho một tiêu chí (áp dụng cho mọi địa điểm). Không có hàng = dùng mặc định. */
@Entity('map_criterion_weights')
@Index('uq_map_criterion_weights_user_criterion', ['userId', 'criterionId'], { unique: true })
export class MapCriterionWeightEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 40, name: 'criterion_id' })
  criterionId: string;

  /** 0–5, số nguyên. */
  @Column({ type: 'smallint' })
  weight: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
