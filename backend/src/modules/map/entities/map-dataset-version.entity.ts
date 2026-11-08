import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type DatasetReleaseKind = 'data' | 'criteria' | 'rollback' | 'hotfix';
export type DatasetReleaseStatus = 'draft' | 'published' | 'withdrawn' | 'abandoned';

/** Một kiểm tra mức bản, ghi lúc phát hành (data-change-playbook.md). */
export interface ReleaseCheck {
  code: string;
  severity: 'blocking' | 'warning';
  status: 'pass' | 'fail';
  expected: string;
  observed: string;
}

/**
 * Bản phát hành dữ liệu đánh giá (018-location-data): bảng kê lớp → phiên bản lớp, cộng bản chụp định nghĩa tiêu chí.
 * Bản hiện hành = version lớn nhất có status = published. Sau khi rời draft, bảng kê và bản chụp không sửa được
 * (trigger tạo trong MapDatasetService). Bản trước 018 có layer_manifest = {} và status mặc định published.
 */
@Entity('map_dataset_versions')
@Index('uk_map_dataset_versions_status_draft', ['status'], { unique: true, where: `"status" = 'draft'` })
@Index('idx_map_dataset_versions_status_version', ['status', 'version'])
export class MapDatasetVersionEntity {
  @PrimaryColumn({ type: 'integer' })
  version: number;

  @Column({ type: 'varchar', length: 500, default: '' })
  note: string;

  @Column({ type: 'varchar', length: 10, default: 'data' })
  kind: DatasetReleaseKind;

  @Column({ type: 'varchar', length: 10, default: 'published' })
  status: DatasetReleaseStatus;

  /** Bản làm gốc để chép bảng kê (bản nháp, thu hồi). */
  @Column({ type: 'integer', name: 'base_version', nullable: true })
  baseVersion: number | null;

  /** {mã lớp: id phiên bản lớp}. Không có khóa ngoại sang geo (research.md Bản ghi 8). */
  @Column({ type: 'jsonb', name: 'layer_manifest', default: () => `'{}'` })
  layerManifest: Record<string, string>;

  /** Bản chụp định nghĩa tiêu chí trong code lúc phát hành. */
  @Column({ type: 'jsonb', name: 'criteria_snapshot', default: () => `'[]'` })
  criteriaSnapshot: unknown[];

  @Column({ type: 'varchar', length: 64, name: 'criteria_hash', nullable: true })
  criteriaHash: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  checks: ReleaseCheck[];

  @Column({ type: 'jsonb', name: 'golden_report', nullable: true })
  goldenReport: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 40, name: 'backend_commit', nullable: true })
  backendCommit: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  /** Admin phát hành; null với phiên bản khởi tạo của hệ thống và bản nháp. */
  @Column({ type: 'uuid', name: 'released_by', nullable: true })
  releasedBy: string | null;

  /** null khi chưa phát hành. */
  @Column({ type: 'timestamptz', name: 'released_at', nullable: true })
  releasedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'withdrawn_at', nullable: true })
  withdrawnAt: Date | null;

  @Column({ type: 'varchar', length: 500, name: 'withdraw_reason', nullable: true })
  withdrawReason: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
