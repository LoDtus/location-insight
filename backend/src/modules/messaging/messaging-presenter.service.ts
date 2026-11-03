import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { UserEntity, UserStatus } from '../auth/entities/user.entity.js';
import { DiscussionPostEntity } from '../discussions/entities/discussion-post.entity.js';
import { MessagingAccessService } from './messaging-access.service.js';
import {
  MessagingPresenceService,
  PresenceView,
} from './messaging-presence.service.js';
import {
  ConversationState,
  excerpt,
  sendGate,
  visibleState,
} from './messaging-rules.js';
import { DELETED_USER_NAME, MESSAGING_LIMITS } from './messaging.constants.js';
import { ConversationEntity } from './entities/conversation.entity.js';
import { ConversationParticipantEntity } from './entities/conversation-participant.entity.js';
import { MessageAttachmentEntity } from './entities/message-attachment.entity.js';
import { MessageReactionEntity } from './entities/message-reaction.entity.js';
import { MessageEntity } from './entities/message.entity.js';
import { ConversationDeleteRequestEntity } from './entities/conversation-delete-request.entity.js';
import { readOptionsFor } from './messaging-attachments.service.js';
import { UNSENT_PREVIEW } from './messaging-rules.js';

export interface PersonView {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AttachmentView {
  id: string;
  kind: 'image' | 'file';
  contentType: string;
  width: number;
  height: number;
  fileName: string | null;
  byteSize: number;
  url: string;
}

export interface MessageView {
  id: string;
  conversationId: string;
  seq: number;
  senderId: string;
  kind: MessageEntity['kind'];
  body: string;
  status: 'visible' | 'deleted';
  clientMsgId: string | null;
  replyTo: { seq: number; senderId: string; excerpt: string } | null;
  attachments: AttachmentView[];
  sharedPost: {
    id: string;
    excerpt: string;
    authorName: string;
    available: boolean;
  } | null;
  reactions: Array<{ emoji: string; count: number; mine: boolean }>;
  createdAt: string;
}

export interface ConversationSummaryView {
  id: string;
  type: 'direct';
  state: ConversationState;
  peer: PersonView;
  lastSeq: number;
  lastReadSeq: number;
  unread: boolean;
  muted: boolean;
  /** Đã ghim lên đầu Inbox (chỉ phía mình). */
  pinned: boolean;
  /** Biệt danh mình đặt cho người kia; chỉ mình thấy. */
  nickname: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  lastSenderIsMe: boolean;
  iAmInitiator: boolean;
}

export interface DeleteRequestView {
  id: string;
  byMe: boolean;
  createdAt: string;
}

export interface ConversationDetailView extends ConversationSummaryView {
  peerLastReadSeq: number | null;
  peerPresence: PresenceView | null;
  canSend: boolean;
  blockedByMe: boolean;
  /** Yêu cầu xóa lịch sử hai phía đang chờ (của mình hoặc của người kia). */
  deleteRequest: DeleteRequestView | null;
}

@Injectable()
export class MessagingPresenterService {
  constructor(
    private readonly access: MessagingAccessService,
    private readonly presence: MessagingPresenceService,
    private readonly storage: StorageService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(ConversationParticipantEntity)
    private readonly participants: Repository<ConversationParticipantEntity>,
    @InjectRepository(MessageEntity)
    private readonly messages: Repository<MessageEntity>,
    @InjectRepository(MessageAttachmentEntity)
    private readonly attachments: Repository<MessageAttachmentEntity>,
    @InjectRepository(MessageReactionEntity)
    private readonly reactions: Repository<MessageReactionEntity>,
    @InjectRepository(DiscussionPostEntity)
    private readonly posts: Repository<DiscussionPostEntity>,
    @InjectRepository(ConversationDeleteRequestEntity)
    private readonly deleteRequests: Repository<ConversationDeleteRequestEntity>,
  ) {}

  async people(ids: string[]): Promise<Map<string, PersonView>> {
    const unique = [...new Set(ids)];
    const rows = unique.length
      ? await this.users.find({ where: { id: In(unique) }, withDeleted: true })
      : [];
    const map = new Map<string, PersonView>();
    for (const row of rows) {
      const gone = Boolean(row.deletedAt) || row.status === UserStatus.DELETED;
      map.set(row.id, {
        id: row.id,
        displayName: gone ? DELETED_USER_NAME : row.displayName,
        avatarUrl: gone ? null : row.avatarUrl,
      });
    }
    for (const id of unique) {
      if (!map.has(id))
        map.set(id, { id, displayName: DELETED_USER_NAME, avatarUrl: null });
    }
    return map;
  }

  async messageViews(
    rows: MessageEntity[],
    viewerId: string,
  ): Promise<MessageView[]> {
    if (!rows.length) return [];
    const conversationId = rows[0]?.conversationId as string;
    const seqs = rows
      .filter((row) => row.status === 'visible')
      .map((row) => row.seq);
    const replySeqs = [
      ...new Set(
        rows.flatMap((row) => (row.replyToSeq ? [row.replyToSeq] : [])),
      ),
    ];
    const postIds = [
      ...new Set(
        rows.flatMap((row) =>
          row.status === 'visible' && row.sharedPostId
            ? [row.sharedPostId]
            : [],
        ),
      ),
    ];
    const [files, reacts, replies, posts] = await Promise.all([
      seqs.length
        ? this.attachments.find({
            where: { conversationId, messageSeq: In(seqs), status: 'ready' },
            order: { sortOrder: 'ASC' },
          })
        : Promise.resolve([]),
      seqs.length
        ? this.reactions.find({
            where: { conversationId, messageSeq: In(seqs) },
          })
        : Promise.resolve([]),
      replySeqs.length
        ? this.messages.find({ where: { conversationId, seq: In(replySeqs) } })
        : Promise.resolve([]),
      postIds.length
        ? this.posts.find({ where: { id: In(postIds), status: 'visible' } })
        : Promise.resolve([]),
    ]);
    const authors = await this.people(posts.map((post) => post.authorId));
    const urls = new Map<string, string>();
    await Promise.all(
      files.map(async (file) => {
        urls.set(
          file.id,
          await this.storage.getPresignedUrl(
            file.objectKey,
            MESSAGING_LIMITS.readUrlTtlSeconds,
            readOptionsFor(file),
          ),
        );
      }),
    );

    return rows.map((row) => {
      const live = row.status === 'visible';
      const target = row.replyToSeq
        ? replies.find((item) => item.seq === row.replyToSeq)
        : undefined;
      const post =
        live && row.sharedPostId
          ? posts.find((item) => item.id === row.sharedPostId)
          : undefined;
      const own = reacts.filter((item) => item.messageSeq === row.seq);
      const grouped = new Map<
        string,
        { emoji: string; count: number; mine: boolean }
      >();
      for (const reaction of own) {
        const entry = grouped.get(reaction.emoji) ?? {
          emoji: reaction.emoji,
          count: 0,
          mine: false,
        };
        entry.count += 1;
        if (reaction.userId === viewerId) entry.mine = true;
        grouped.set(reaction.emoji, entry);
      }
      return {
        id: row.id,
        conversationId: row.conversationId,
        seq: row.seq,
        senderId: row.senderId,
        kind: row.kind,
        body: live ? row.body : '',
        status: live ? 'visible' : 'deleted',
        clientMsgId: row.senderId === viewerId ? row.clientMsgId : null,
        replyTo:
          live && row.replyToSeq && target
            ? {
                seq: target.seq,
                senderId: target.senderId,
                excerpt:
                  target.status === 'visible'
                    ? excerpt(target.body || previewOfKind(target.kind))
                    : UNSENT_PREVIEW,
              }
            : null,
        attachments: live
          ? files
              .filter((file) => file.messageSeq === row.seq)
              .map((file) => ({
                id: file.id,
                kind: file.kind,
                contentType: file.contentType,
                width: file.width ?? 0,
                height: file.height ?? 0,
                fileName: file.fileName,
                byteSize: file.byteSize,
                url: urls.get(file.id) ?? '',
              }))
          : [],
        sharedPost:
          live && row.sharedPostId
            ? {
                id: row.sharedPostId,
                excerpt: post
                  ? excerpt(post.body, MESSAGING_LIMITS.sharedExcerptMax)
                  : '',
                authorName: post
                  ? (authors.get(post.authorId)?.displayName ?? '')
                  : '',
                available: Boolean(post),
              }
            : null,
        reactions: live ? [...grouped.values()] : [],
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async summaries(
    entries: Array<{
      conversation: ConversationEntity;
      me: ConversationParticipantEntity;
    }>,
    viewerId: string,
  ): Promise<ConversationSummaryView[]> {
    if (!entries.length) return [];
    const ids = entries.map((entry) => entry.conversation.id);
    const others = await this.participants.find({
      where: { conversationId: In(ids) },
    });
    const peerOf = new Map<string, string>();
    for (const row of others) {
      if (row.userId !== viewerId) peerOf.set(row.conversationId, row.userId);
    }
    const people = await this.people([...peerOf.values()]);
    return entries.map(({ conversation, me }) => {
      const peerId = peerOf.get(conversation.id) ?? '';
      const iAmInitiator = conversation.initiatorId === viewerId;
      const muted = Boolean(
        me.mutedUntil && me.mutedUntil.getTime() > Date.now(),
      );
      return {
        id: conversation.id,
        type: 'direct',
        state: visibleState(conversation.state, iAmInitiator),
        peer: people.get(peerId) ?? {
          id: peerId,
          displayName: DELETED_USER_NAME,
          avatarUrl: null,
        },
        lastSeq: conversation.lastSeq,
        lastReadSeq: me.lastReadSeq,
        unread: conversation.lastSeq > me.lastReadSeq,
        muted,
        pinned: me.pinnedAt !== null,
        nickname: me.peerNickname,
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        lastSenderIsMe: conversation.lastSenderId === viewerId,
        iAmInitiator,
      };
    });
  }

  async detail(
    conversation: ConversationEntity,
    me: ConversationParticipantEntity,
    peerId: string,
    viewerId: string,
  ): Promise<ConversationDetailView> {
    const [summary] = await this.summaries([{ conversation, me }], viewerId);
    const [peerRow, blocks, prefs, peerParticipant, pendingDelete] =
      await Promise.all([
        this.users.findOne({ where: { id: peerId }, withDeleted: true }),
        this.access.blockedBetween(viewerId, peerId),
        this.access.preferencesMany([viewerId, peerId]),
        this.participants.findOne({
          where: { conversationId: conversation.id, userId: peerId },
        }),
        this.deleteRequests.findOne({
          where: { conversationId: conversation.id, status: 'pending' },
        }),
      ]);
    const mine = prefs.get(viewerId);
    const theirs = prefs.get(peerId);
    const peerGone =
      !peerRow ||
      Boolean(peerRow.deletedAt) ||
      peerRow.status !== UserStatus.ACTIVE;
    const gate = sendGate({
      state: conversation.state,
      iAmInitiator: conversation.initiatorId === viewerId,
      lastSeq: conversation.lastSeq,
      kind: 'text',
    });
    const readsVisible = Boolean(
      mine?.sendReadReceipts && theirs?.sendReadReceipts,
    );
    const presenceVisible =
      Boolean(mine?.showActivityStatus && theirs?.showActivityStatus) &&
      conversation.state === 'active' &&
      !blocks.aBlocksB &&
      !blocks.bBlocksA &&
      !peerGone;
    return {
      ...(summary as ConversationSummaryView),
      peerLastReadSeq: readsVisible
        ? (peerParticipant?.lastReadSeq ?? 0)
        : null,
      peerPresence: presenceVisible ? await this.presence.read(peerId) : null,
      canSend:
        gate === 'ok' && !peerGone && !blocks.aBlocksB && !blocks.bBlocksA,
      blockedByMe: blocks.aBlocksB,
      deleteRequest: pendingDelete
        ? {
            id: pendingDelete.id,
            byMe: pendingDelete.requesterId === viewerId,
            createdAt: pendingDelete.createdAt.toISOString(),
          }
        : null,
    };
  }
}

function previewOfKind(kind: MessageEntity['kind']): string {
  if (kind === 'image') return 'Ảnh';
  if (kind === 'file') return 'Tệp';
  if (kind === 'post_share') return 'Bài viết';
  return '';
}
