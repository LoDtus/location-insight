import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer.js';

export type MessageKindValue = 'text' | 'image' | 'post_share' | 'system';
export type MessageStatusValue = 'visible' | 'deleted' | 'hidden';

/**
 * Khóa chính (conversation_id, seq): mọi truy vấn kèm conversation_id,
 * để sau này hash partition theo conversation_id mà không đổi khóa.
 */
@Entity('messages')
@Index('uk_messages_conversation_id_id', ['conversationId', 'id'], { unique: true })
@Index('uk_messages_client_msg', ['conversationId', 'senderId', 'clientMsgId'], { unique: true })
@Index('idx_messages_sender_created', ['senderId', 'createdAt'])
export class MessageEntity {
  @PrimaryColumn({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @PrimaryColumn({ type: 'bigint', transformer: bigintTransformer })
  seq: number;

  @Column({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'sender_id' })
  senderId: string;

  @Column({ type: 'varchar', length: 12, default: 'text' })
  kind: MessageKindValue;

  @Column({ type: 'varchar', length: 2000, default: '' })
  body: string;

  @Column({ type: 'bigint', name: 'reply_to_seq', nullable: true, transformer: bigintTransformer })
  replyToSeq: number | null;

  @Column({ type: 'uuid', name: 'shared_post_id', nullable: true })
  sharedPostId: string | null;

  @Column({ type: 'uuid', name: 'client_msg_id' })
  clientMsgId: string;

  @Column({ type: 'varchar', length: 10, default: 'visible' })
  status: MessageStatusValue;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
