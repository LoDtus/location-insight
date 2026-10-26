import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from './user.entity.js';

export type OneTimePurpose = 'verify_email' | 'reset_password';

@Entity('auth_one_time_tokens')
@Index('idx_auth_one_time_tokens_user_purpose', ['userId', 'purpose'])
export class AuthOneTimeTokenEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  purpose: OneTimePurpose;

  @Index('uk_auth_one_time_tokens_token_hash', { unique: true })
  @Column({ type: 'char', length: 64, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'used_at', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;
}
