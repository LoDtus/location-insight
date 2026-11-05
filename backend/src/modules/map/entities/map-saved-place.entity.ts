import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Địa điểm người dùng đã lưu trên bản đồ. Mỗi người lưu một địa điểm (map_places) đúng một lần. */
@Entity('map_saved_places')
@Index('uq_map_saved_places_user_place', ['userId', 'placeId'], { unique: true })
@Index('idx_map_saved_places_user_created', ['userId', 'createdAt'])
export class MapSavedPlaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'place_id' })
  placeId: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  address: string;

  /** Loại địa điểm theo Vietmap (poi, address, street…); null nếu không rõ. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  kind: string | null;

  /** Tên gợi nhớ người dùng tự đặt; null = dùng tên gốc. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  label: string | null;

  /** Ghi chú riêng của người dùng (nhiều dòng). */
  @Column({ type: 'varchar', length: 1000, default: '' })
  note: string;

  /** Lúc đưa vào danh sách so sánh; null = không so sánh. */
  @Column({ type: 'timestamptz', name: 'compared_at', nullable: true })
  comparedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
