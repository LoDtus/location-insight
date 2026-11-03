import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SearchOutboxOp = 'upsert' | 'delete';
export type SearchOutboxStatus = 'pending' | 'processing' | 'dead';

/**
 * Hàng đợi đồng bộ PostgreSQL → Elasticsearch (xem 017-search-elasticsearch/postgresql.dbml).
 * Không lưu payload: worker luôn đọc trạng thái hiện tại từ bảng nguồn.
 */
@Entity('search_outbox')
@Index('uk_search_outbox_profile_doc_id', ['profile', 'docId'], {
  unique: true,
})
@Index('idx_search_outbox_status_next_attempt_at', ['status', 'nextAttemptAt'])
export class SearchOutboxEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 64 })
  profile: string;

  @Column({ type: 'varchar', length: 64, name: 'doc_id' })
  docId: string;

  @Column({ type: 'varchar', length: 10 })
  op: SearchOutboxOp;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: SearchOutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Tăng mỗi lần ghi đè dòng chờ; worker chỉ xóa/cập nhật đúng revision đã nhận để không mất thay đổi mới. */
  @Column({ type: 'bigint', default: 1 })
  revision: string;

  @Column({
    type: 'timestamptz',
    name: 'next_attempt_at',
    default: () => 'now()',
  })
  nextAttemptAt: Date;

  @Column({ type: 'varchar', length: 200, name: 'last_error', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
