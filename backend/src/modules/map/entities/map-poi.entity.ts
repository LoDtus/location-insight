import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Điểm tiện ích cho các lớp bản đồ (trường học, ngân hàng, chợ…), nhập từ data/curated/places bằng
 * scripts/import-places.ts. Không nhận ghi từ API.
 */
@Entity('map_pois')
@Index('uq_map_pois_source', ['source', 'sourceId'], { unique: true })
@Index('idx_map_pois_lat_lng', ['lat', 'lng'])
export class MapPoiEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nhóm lớp: school, bank, market… (MAP_POI_CATEGORIES). */
  @Column({ type: 'varchar', length: 20 })
  category: string;

  /** Giá trị thẻ gốc: kindergarten, atm, cafe… */
  @Column({ type: 'varchar', length: 30, default: '' })
  kind: string;

  @Column({ type: 'varchar', length: 160, default: '' })
  name: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', length: 20 })
  source: string;

  @Column({ type: 'varchar', length: 40, name: 'source_id' })
  sourceId: string;

  /** Phiên bản dữ liệu nguồn (ngày tải), vd. 2026-10-18. */
  @Column({ type: 'varchar', length: 20, name: 'source_version' })
  sourceVersion: string;
}
