import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';
import { bigintTransformer } from './bigint.transformer.js';
import { ConversationEntity } from './conversation.entity.js';

export type DeleteRequestStatus =
  'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

/**
 * Yêu cầu xóa lịch sử trò chuyện ở CẢ HAI phía: chỉ có hiệu lực khi người kia đồng ý.
 * Mỗi hội thoại chỉ có tối đa một yêu cầu đang chờ.
 */
@Entity('conversation_delete_requests')
@Index('uk_delete_requests_pending', ['conversationId'], {
  unique: true,
  where: '"status" = \'pending\'',
})
@Index('idx_delete_requests_status_created', ['status', 'createdAt'])
export class ConversationDeleteRequestEntity extends AppBaseEntity {
  @ManyToOne(() => ConversationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationEntity;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @Column({ type: 'uuid', name: 'requester_id' })
  requesterId: string;

  /** Chỉ xóa các tin có seq ≤ giá trị này (tin gửi sau khi yêu cầu không bị xóa). */
  @Column({ type: 'bigint', name: 'up_to_seq', transformer: bigintTransformer })
  upToSeq: number;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: DeleteRequestStatus;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;
}
