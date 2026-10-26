import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from './user.entity.js';

export enum AuthProvider {
  GOOGLE = 'google',
  PASSWORD = 'password',
}

@Entity('auth_identities')
@Index('uk_auth_identities_provider_subject', ['provider', 'providerUserId'], {
  unique: true,
})
export class AuthIdentityEntity extends AppBaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Index('idx_auth_identities_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255, name: 'provider_user_id' })
  providerUserId: string;

  @Column({
    type: 'varchar',
    length: 254,
    name: 'email_at_link',
    nullable: true,
  })
  emailAtLink: string | null;

  @Column({ type: 'timestamptz', name: 'last_used_at', nullable: true })
  lastUsedAt: Date | null;
}
