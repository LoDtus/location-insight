import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_follow_stats')
export class UserFollowStatsEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'int', name: 'follower_count', default: 0 })
  followerCount: number;

  @Column({ type: 'int', name: 'following_count', default: 0 })
  followingCount: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
