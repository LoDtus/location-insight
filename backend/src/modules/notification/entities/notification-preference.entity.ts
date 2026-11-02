import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export interface ChannelPreference {
  inApp: boolean;
  push: boolean;
}

export type PreferenceGroups = Partial<
  Record<'social' | 'messages' | 'billing' | 'moderation' | 'system', ChannelPreference>
>;

@Entity('notification_preferences')
export class NotificationPreferenceEntity {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @Column({ type: 'boolean', name: 'hide_content_on_lock_screen', default: false })
  hideContentOnLockScreen: boolean;

  @Column({ type: 'jsonb', default: {} })
  groups: PreferenceGroups;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
