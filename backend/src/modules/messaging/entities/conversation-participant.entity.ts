import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../../auth/entities/user.entity.js';
import { bigintTransformer } from './bigint.transformer.js';
import { ConversationEntity } from './conversation.entity.js';

@Entity('conversation_participants')
@Index('idx_participants_user_activity', ['userId', 'lastActivityAt'], {
  where: '"hidden_at" IS NULL AND "left_at" IS NULL',
})
export class ConversationParticipantEntity {
  @PrimaryColumn({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => ConversationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 10, default: 'member' })
  role: 'member' | 'owner';

  @Column({
    type: 'bigint',
    name: 'last_read_seq',
    default: 0,
    transformer: bigintTransformer,
  })
  lastReadSeq: number;

  @Column({
    type: 'bigint',
    name: 'cleared_before_seq',
    default: 0,
    transformer: bigintTransformer,
  })
  clearedBeforeSeq: number;

  @Column({
    type: 'timestamptz',
    name: 'last_activity_at',
    default: () => 'now()',
  })
  lastActivityAt: Date;

  @Column({ type: 'timestamptz', name: 'hidden_at', nullable: true })
  hiddenAt: Date | null;

  @Column({ type: 'timestamptz', name: 'muted_until', nullable: true })
  mutedUntil: Date | null;

  /** Ghim cuộc trò chuyện lên đầu Inbox (chỉ phía mình). */
  @Column({ type: 'timestamptz', name: 'pinned_at', nullable: true })
  pinnedAt: Date | null;

  /** Biệt danh mình đặt cho người kia; chỉ mình nhìn thấy. */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'peer_nickname',
    nullable: true,
  })
  peerNickname: string | null;

  @Column({ type: 'timestamptz', name: 'joined_at', default: () => 'now()' })
  joinedAt: Date;

  @Column({ type: 'timestamptz', name: 'left_at', nullable: true })
  leftAt: Date | null;
}
