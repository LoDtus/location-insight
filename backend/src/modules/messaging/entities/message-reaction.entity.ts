import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer.js';

@Entity('message_reactions')
export class MessageReactionEntity {
  @PrimaryColumn({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @PrimaryColumn({ type: 'bigint', name: 'message_seq', transformer: bigintTransformer })
  messageSeq: number;

  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  emoji: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
