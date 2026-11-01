import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';
import { bigintTransformer } from './bigint.transformer.js';

export type ConversationType = 'direct' | 'group';
export type ConversationStateValue = 'pending' | 'active' | 'declined';

@Entity('conversations')
@Index('idx_conversations_state_created_at', ['state', 'createdAt'])
export class ConversationEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 10, default: 'direct' })
  type: ConversationType;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  state: ConversationStateValue;

  @Index('uk_conversations_direct_key', { unique: true })
  @Column({ type: 'varchar', length: 73, name: 'direct_key', nullable: true })
  directKey: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiator_id' })
  initiator: UserEntity;

  @Column({ type: 'uuid', name: 'initiator_id' })
  initiatorId: string;

  @Column({ type: 'bigint', name: 'last_seq', default: 0, transformer: bigintTransformer })
  lastSeq: number;

  @Column({ type: 'timestamptz', name: 'last_message_at', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'uuid', name: 'last_sender_id', nullable: true })
  lastSenderId: string | null;

  @Column({ type: 'varchar', length: 120, name: 'last_message_preview', default: '' })
  lastMessagePreview: string;
}
