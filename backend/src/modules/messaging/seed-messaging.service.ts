import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { UserEntity } from '../auth/entities/user.entity.js';
import { DiscussionPostEntity } from '../discussions/entities/discussion-post.entity.js';
import { ConversationParticipantEntity } from './entities/conversation-participant.entity.js';
import { ConversationEntity } from './entities/conversation.entity.js';
import { MessageReactionEntity } from './entities/message-reaction.entity.js';
import { MessageEntity } from './entities/message.entity.js';
import { directKey, previewFor, UNSENT_PREVIEW } from './messaging-rules.js';
import { SEED_CONVERSATIONS, Side } from './seed.config.js';

/** Hội thoại mẫu cho môi trường dev: chạy một lần, bỏ qua nếu đã có hội thoại giữa hai tài khoản mẫu. */
@Injectable()
export class SeedMessagingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedMessagingService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
    @InjectRepository(DiscussionPostEntity)
    private readonly posts: Repository<DiscussionPostEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    try {
      await this.seed();
    } catch (error) {
      this.logger.warn(
        `Chưa tạo được hội thoại mẫu: ${error instanceof Error ? error.message : 'không rõ'}`,
      );
    }
  }

  private async seed(): Promise<void> {
    const emails = [...new Set(SEED_CONVERSATIONS.flatMap((item) => [item.a, item.b]))];
    const people = await this.users.find({ where: { email: In(emails) } });
    const byEmail = new Map(people.map((user) => [user.email, user]));
    const post = await this.posts.findOne({
      where: { status: 'visible', rootId: IsNull() },
      order: { createdAt: 'DESC' },
    });

    let created = 0;
    for (const spec of SEED_CONVERSATIONS) {
      const a = byEmail.get(spec.a);
      const b = byEmail.get(spec.b);
      if (!a || !b) continue;
      const key = directKey(a.id, b.id);
      if (await this.conversations.exists({ where: { directKey: key } })) continue;
      await this.createConversation(spec, a.id, b.id, key, post?.id ?? null);
      created += 1;
    }
    if (created) this.logger.log(`Đã tạo ${created} hội thoại mẫu.`);
  }

  private async createConversation(
    spec: (typeof SEED_CONVERSATIONS)[number],
    aId: string,
    bId: string,
    key: string,
    postId: string | null,
  ): Promise<void> {
    const id = (side: Side): string => (side === 'a' ? aId : bId);
    const now = Date.now();
    const rows = spec.messages
      .map((item, index) => ({ ...item, index: index + 1 }))
      .filter((item) => !item.share || postId)
      .sort((x, y) => y.ago - x.ago || x.index - y.index);
    const seqByIndex = new Map(rows.map((item, position) => [item.index, position + 1]));
    const last = rows.at(-1);
    if (!last) return;
    const first = rows[0];
    const lastSeq = rows.length;
    const lastAt = new Date(now - last.ago * 60_000);
    const readOf = (side: Side): number => {
      const own = rows.reduce((max, item, position) => (item.from === side ? position + 1 : max), 0);
      return Math.max(own, lastSeq - (spec.unread?.[side] ?? 0));
    };
    const lastLive = last.unsent ? UNSENT_PREVIEW : previewFor(last.share ? 'post_share' : 'text', last.text ?? '');
    const conversationId = uuidv7();

    await this.dataSource.transaction(async (manager) => {
      await manager.insert(ConversationEntity, {
        id: conversationId,
        type: 'direct',
        state: spec.state ?? 'active',
        directKey: key,
        initiatorId: id(first?.from ?? 'a'),
        lastSeq,
        lastMessageAt: lastAt,
        lastSenderId: id(last.from),
        lastMessagePreview: lastLive,
      });
      await manager.insert(ConversationParticipantEntity, (['a', 'b'] as const).map((side) => ({
        conversationId,
        userId: id(side),
        role: 'member' as const,
        lastReadSeq: readOf(side),
        lastActivityAt: lastAt,
        mutedUntil: spec.mutedBy === side ? new Date('9999-12-31T00:00:00.000Z') : null,
      })));

      for (const [position, item] of rows.entries()) {
        const seq = position + 1;
        const reply = item.reply ? seqByIndex.get(item.reply) : undefined;
        const kind = item.share ? 'post_share' : 'text';
        await manager.insert(MessageEntity, {
          conversationId,
          seq,
          id: uuidv7(),
          senderId: id(item.from),
          kind,
          body: item.unsent ? '' : item.share ? '' : (item.text ?? ''),
          replyToSeq: reply ?? null,
          sharedPostId: item.share ? postId : null,
          clientMsgId: uuidv7(),
          status: item.unsent ? 'deleted' : 'visible',
          createdAt: new Date(now - item.ago * 60_000),
          deletedAt: item.unsent ? new Date(now - item.ago * 60_000 + 60_000) : null,
        });
        for (const [side, emoji] of item.reactions ?? []) {
          await manager.insert(MessageReactionEntity, {
            conversationId,
            messageSeq: seq,
            userId: id(side),
            emoji,
          });
        }
      }
    });
  }
}
