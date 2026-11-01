import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { SuppressionReason } from '../email.constants.js';

@Entity('email_suppressions')
export class EmailSuppressionEntity {
  @PrimaryColumn({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  reason: SuppressionReason;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
