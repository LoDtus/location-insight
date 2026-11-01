import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../../../shared/database/typeorm/base.entity.js';

/** Bản ghi đè do admin tùy biến. Không có dòng = dùng mặc định trong mã. */
@Entity('email_templates')
@Index('uk_email_templates_key_locale', ['key', 'locale'], { unique: true })
export class EmailTemplateEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 60 })
  key: string;

  @Column({ type: 'varchar', length: 5, default: 'vi' })
  locale: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text', name: 'body_html' })
  bodyHtml: string;

  @Column({ type: 'text', name: 'body_text', nullable: true })
  bodyText: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy: string | null;
}
