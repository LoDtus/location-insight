import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';

@Entity('feedback_media')
@Index('idx_feedback_media_feedback', ['feedbackId'])
@Index('idx_feedback_media_uploader_status', ['uploaderId', 'status'])
export class FeedbackMediaEntity extends AppBaseEntity {
  @Column({ type: 'uuid', name: 'feedback_id', nullable: true })
  feedbackId: string | null;

  @Column({ type: 'uuid', name: 'uploader_id' })
  uploaderId: string;

  @Index('uk_feedback_media_object_key', { unique: true })
  @Column({ type: 'varchar', length: 240, name: 'object_key' })
  objectKey: string;

  @Column({ type: 'varchar', length: 40, name: 'content_type' })
  contentType: string;

  @Column({ type: 'int', name: 'byte_size' })
  byteSize: number;

  @Column({ type: 'varchar', length: 10 })
  kind: 'image' | 'video';

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: 'pending' | 'ready' | 'rejected';

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;
}
