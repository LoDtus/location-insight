import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const CONSTRAINTS: Array<{ table: string; name: string; sql: string }> = [
  { table: 'messages', name: 'ck_messages_seq_positive', sql: 'CHECK (seq > 0)' },
  {
    table: 'messages',
    name: 'ck_messages_post_share',
    sql: `CHECK ((kind = 'post_share') = (shared_post_id IS NOT NULL))`,
  },
  {
    table: 'messages',
    name: 'ck_messages_text_body',
    sql: `CHECK (kind <> 'text' OR status <> 'visible' OR char_length(btrim(body)) > 0)`,
  },
  {
    table: 'messages',
    name: 'fk_messages_reply',
    sql: 'FOREIGN KEY (conversation_id, reply_to_seq) REFERENCES messages (conversation_id, seq) ON DELETE SET NULL (reply_to_seq)',
  },
  {
    table: 'messages',
    name: 'fk_messages_conversation',
    sql: 'FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE',
  },
  {
    table: 'message_attachments',
    name: 'fk_attachments_message',
    sql: 'FOREIGN KEY (conversation_id, message_seq) REFERENCES messages (conversation_id, seq) ON DELETE CASCADE',
  },
  {
    table: 'message_reactions',
    name: 'fk_reactions_message',
    sql: 'FOREIGN KEY (conversation_id, message_seq) REFERENCES messages (conversation_id, seq) ON DELETE CASCADE',
  },
  {
    table: 'user_blocks',
    name: 'ck_user_blocks_self',
    sql: 'CHECK (blocker_id <> blocked_id)',
  },
];

/**
 * TypeORM `synchronize` không tạo CHECK và khóa ngoại ghép; thêm lại một cách idempotent.
 * Chỉ chạy khi `synchronize` đang bật (môi trường chưa dùng migration).
 */
@Injectable()
export class MessagingSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MessagingSchemaService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('TYPEORM_SYNCHRONIZE') !== 'true') return;
    for (const item of CONSTRAINTS) {
      try {
        const found = (await this.dataSource.query(
          `SELECT 1 FROM pg_constraint WHERE conname = $1`,
          [item.name],
        )) as unknown[];
        if (found.length) continue;
        await this.dataSource.query(
          `ALTER TABLE ${item.table} ADD CONSTRAINT ${item.name} ${item.sql}`,
        );
      } catch (error) {
        this.logger.warn(
          `Chưa thêm được ${item.name}: ${error instanceof Error ? error.message : 'không rõ'}`,
        );
      }
    }
  }
}
