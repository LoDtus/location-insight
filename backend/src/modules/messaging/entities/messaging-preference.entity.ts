import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('messaging_preferences')
export class MessagingPreferenceEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10, name: 'who_can_message', default: 'everyone' })
  whoCanMessage: 'everyone' | 'nobody';

  @Column({ type: 'boolean', name: 'show_activity_status', default: true })
  showActivityStatus: boolean;

  @Column({ type: 'boolean', name: 'send_read_receipts', default: true })
  sendReadReceipts: boolean;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
