import { Check, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('user_follows')
@Check('ck_user_follows_self', '"follower_id" <> "followee_id"')
@Index('idx_user_follows_follower_created', ['followerId', 'createdAt', 'followeeId'])
@Index('idx_user_follows_followee_created', ['followeeId', 'createdAt', 'followerId'])
export class UserFollowEntity {
  @PrimaryColumn({ type: 'uuid', name: 'follower_id' })
  followerId: string;

  @PrimaryColumn({ type: 'uuid', name: 'followee_id' })
  followeeId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
