import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { UserEntity } from '../../auth/entities/user.entity.js';
import { bigintTransformer } from './bigint.transformer.js';
import { ConversationEntity } from './conversation.entity.js';

export type AttachmentStatus = 'pending' | 'ready' | 'rejected';

@Entity('message_attachments')
@Index('idx_attachments_message', ['conversationId', 'messageSeq'])
@Index('idx_attachments_uploader_status', ['uploaderId', 'status'])
@Index('idx_attachments_status_created', ['status', 'createdAt'])
export class MessageAttachmentEntity extends AppBaseEntity {
  @ManyToOne(() => ConversationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationEntity;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @Column({ type: 'bigint', name: 'message_seq', nullable: true, transformer: bigintTransformer })
  messageSeq: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploader_id' })
  uploader: UserEntity;

  @Column({ type: 'uuid', name: 'uploader_id' })
  uploaderId: string;

  @Index('uk_attachments_object_key', { unique: true })
  @Column({ type: 'varchar', length: 240, name: 'object_key' })
  objectKey: string;

  @Column({ type: 'varchar', length: 40, name: 'content_type' })
  contentType: string;

  @Column({ type: 'int', name: 'byte_size' })
  byteSize: number;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'smallint', name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: AttachmentStatus;
}
