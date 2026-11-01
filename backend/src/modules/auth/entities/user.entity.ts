import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserRole } from '../../rbac/authorization.types.js';

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  DELETED = 'deleted',
}

@Entity('users')
export class UserEntity extends AppBaseEntity {
  @Index('uk_users_email', { unique: true })
  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'timestamptz', name: 'email_verified_at', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 100, name: 'display_name' })
  displayName: string;

  @Column({ type: 'varchar', length: 512, name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Index('uk_users_username', { unique: true, where: 'username IS NOT NULL' })
  @Column({ type: 'varchar', length: 40, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 500, default: '' })
  bio: string;

  @Index('idx_users_role')
  @Column({ type: 'varchar', length: 20, default: UserRole.USER })
  role: UserRole.USER | UserRole.ADMIN;

  @Index('idx_users_status')
  @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'password_hash',
    nullable: true,
  })
  passwordHash: string | null;

  @Column({ type: 'timestamptz', name: 'password_changed_at', nullable: true })
  passwordChangedAt: Date | null;

  @Column({ type: 'int', name: 'failed_login_count', default: 0 })
  failedLoginCount: number;

  @Column({ type: 'timestamptz', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'varchar', length: 5, default: 'vi' })
  locale: string;
}
