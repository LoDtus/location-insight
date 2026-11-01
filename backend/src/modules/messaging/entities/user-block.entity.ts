import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('user_blocks')
@Index('idx_user_blocks_blocked', ['blockedId'])
export class UserBlockEntity {
  @PrimaryColumn({ type: 'uuid', name: 'blocker_id' })
  blockerId: string;

  @PrimaryColumn({ type: 'uuid', name: 'blocked_id' })
  blockedId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
