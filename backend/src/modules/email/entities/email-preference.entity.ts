import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('email_preferences')
export class EmailPreferenceEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  category: string;

  @Column({ type: 'boolean' })
  enabled: boolean;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
