import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Địa điểm chuẩn hóa để đánh giá/lưu: gom các cú bấm cùng địa chỉ (≤ 150 m) hoặc sát nhau (≤ 20 m) về một
 * bản ghi. Xem place-identity.ts. Tọa độ là điểm bấm đầu tiên tạo ra địa điểm.
 */
@Entity('map_places')
@Index('idx_map_places_lat_lng', ['lat', 'lng'])
@Index('idx_map_places_address_key', ['addressKey'])
export class MapPlaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  /** Địa chỉ chuẩn hóa (bỏ dấu, thường) khi Reverse đủ sát; null nếu chỉ là một điểm trên bản đồ. */
  @Column({ type: 'varchar', length: 300, name: 'address_key', nullable: true })
  addressKey: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  name: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  address: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
