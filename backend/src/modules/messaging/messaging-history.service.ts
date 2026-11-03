import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { NotificationsService } from '../notification/notification.service.js';
import { UserRole } from '../rbac/authorization.types.js';
import { MessagingAccessService } from './messaging-access.service.js';
import { MessagingConversationsService } from './messaging-conversations.service.js';
import { rowsOf } from './messaging-db.js';
import { conflict, invalid, notFound } from './messaging-errors.js';
import { MessagingEventsService } from './messaging-events.service.js';
import { MessagingRateLimitService } from './messaging-rate-limit.service.js';
import { MESSAGING_CHANNELS, MESSAGING_LIMITS } from './messaging.constants.js';
import { ConversationDeleteRequestEntity } from './entities/conversation-delete-request.entity.js';

export interface DeleteRequestResult {
  id: string;
  byMe: boolean;
  createdAt: string;
}

/**
 * Xóa lịch sử trò chuyện ở CẢ HAI phía: người yêu cầu gửi lời mời, người kia phải đồng ý thì tin mới bị xóa thật.
 * Tin đang có báo cáo mở được giữ lại (bằng chứng cho quản trị) nhưng vẫn bị ẩn khỏi cả hai người.
 */
@Injectable()
export class MessagingHistoryService {
  private readonly logger = new Logger(MessagingHistoryService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly access: MessagingAccessService,
    private readonly events: MessagingEventsService,
    private readonly conversations: MessagingConversationsService,
    private readonly rate: MessagingRateLimitService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    @InjectRepository(ConversationDeleteRequestEntity)
    private readonly requests: Repository<ConversationDeleteRequestEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async request(
    userId: string,
    conversationId: string,
  ): Promise<DeleteRequestResult> {
    const m = await this.access.membership(userId, conversationId);
    await this.access.assertPeerReachable(userId, m.peerId);
    if (m.conversation.state !== 'active') {
      invalid(
        'Chỉ xóa hai phía được khi cuộc trò chuyện đã được chấp nhận. Hãy dùng "Xóa phía tôi".',
      );
    }
    if (m.conversation.lastSeq <= m.me.clearedBeforeSeq)
      invalid('Chưa có tin nhắn nào để xóa.');

    const pending = await this.requests.findOne({
      where: { conversationId, status: 'pending' },
    });
    if (pending) {
      if (pending.requesterId === userId) return this.toResult(pending, userId);
      conflict(
        'Người này đã gửi yêu cầu xóa lịch sử. Hãy đồng ý hoặc từ chối trước.',
      );
    }
    await this.rate.consume('deleteRequest', `user_${userId}`);

    let created: ConversationDeleteRequestEntity;
    try {
      created = await this.requests.save(
        this.requests.create({
          conversationId,
          requesterId: userId,
          upToSeq: m.conversation.lastSeq,
          status: 'pending',
        }),
      );
    } catch {
      // Hai bên cùng gửi một lúc: ràng buộc duy nhất chỉ cho một yêu cầu đang chờ.
      conflict('Đã có yêu cầu xóa lịch sử đang chờ.');
    }
    await this.events.publish(
      MESSAGING_CHANNELS.conversationUpdated,
      [userId, m.peerId],
      {
        conversationId,
        reason: 'delete_requested',
      },
    );
    await this.notifyPeer(userId, m.peerId, conversationId, created.id);
    return this.toResult(created, userId);
  }

  /** Người yêu cầu rút lại. */
  async cancel(userId: string, conversationId: string): Promise<void> {
    const m = await this.access.membership(userId, conversationId);
    const pending = await this.mustFindPending(conversationId);
    if (pending.requesterId !== userId) notFound('Không tìm thấy yêu cầu.');
    await this.resolve(pending.id, 'cancelled');
    await this.events.publish(
      MESSAGING_CHANNELS.conversationUpdated,
      [userId, m.peerId],
      {
        conversationId,
        reason: 'delete_resolved',
      },
    );
  }

  /** Người kia từ chối. */
  async decline(userId: string, conversationId: string): Promise<void> {
    const m = await this.access.membership(userId, conversationId);
    const pending = await this.mustFindPending(conversationId);
    if (pending.requesterId === userId) notFound('Không tìm thấy yêu cầu.');
    await this.resolve(pending.id, 'declined');
    await this.events.publish(
      MESSAGING_CHANNELS.conversationUpdated,
      [userId, m.peerId],
      {
        conversationId,
        reason: 'delete_resolved',
      },
    );
  }

  /** Người kia đồng ý: xóa thật các tin tới `up_to_seq` ở cả hai phía. */
  async accept(userId: string, conversationId: string): Promise<void> {
    const m = await this.access.membership(userId, conversationId);
    const pending = await this.mustFindPending(conversationId);
    if (pending.requesterId === userId) notFound('Không tìm thấy yêu cầu.');

    const keys = await this.dataSource.transaction(async (manager) => {
      // Chốt trạng thái trước để hai lần bấm đồng ý không chạy xóa hai lần.
      const claimed = rowsOf<{ up_to_seq: string }>(
        await manager.query(
          `UPDATE conversation_delete_requests SET status = 'accepted', resolved_at = now(), updated_at = now()
            WHERE id = $1 AND status = 'pending' RETURNING up_to_seq`,
          [pending.id],
        ),
      )[0];
      if (!claimed) return null;
      const upTo = Number(claimed.up_to_seq);

      const objects = rowsOf<{ object_key: string }>(
        await manager.query(
          `SELECT a.object_key
             FROM message_attachments a
             JOIN messages m ON m.conversation_id = a.conversation_id AND m.seq = a.message_seq
            WHERE a.conversation_id = $1 AND a.message_seq <= $2 AND ${NO_OPEN_REPORT}`,
          [conversationId, upTo],
        ),
      );
      await manager.query(
        `DELETE FROM messages m WHERE m.conversation_id = $1 AND m.seq <= $2 AND ${NO_OPEN_REPORT}`,
        [conversationId, upTo],
      );
      await manager.query(
        `UPDATE conversation_participants
            SET cleared_before_seq = GREATEST(cleared_before_seq, $2::bigint),
                last_read_seq = GREATEST(last_read_seq, $2::bigint)
          WHERE conversation_id = $1`,
        [conversationId, upTo],
      );
      await manager.query(
        `UPDATE conversations
            SET last_message_preview = CASE WHEN last_seq <= $2 THEN '' ELSE last_message_preview END,
                updated_at = now()
          WHERE id = $1`,
        [conversationId, upTo],
      );
      return objects.map((row) => row.object_key);
    });
    if (keys === null) conflict('Yêu cầu này đã được xử lý.');

    if (keys.length > 0) {
      const failed = await this.storage.deleteObjects(keys).catch(() => keys);
      if (failed.length > 0)
        this.logger.warn(
          `Chưa xóa được ${failed.length} tệp sau khi xóa lịch sử`,
        );
    }
    const members = [userId, m.peerId];
    await this.conversations.invalidateUnread(members);
    await this.events.publish(MESSAGING_CHANNELS.conversationUpdated, members, {
      conversationId,
      reason: 'history_cleared',
    });
    await this.events.publish(MESSAGING_CHANNELS.unread, members, {});
  }

  /** Yêu cầu quá hạn (không ai trả lời) tự hết hiệu lực; gọi từ job dọn dẹp. */
  async expireStale(): Promise<number> {
    const expired = rowsOf<{ conversation_id: string }>(
      await this.dataSource.query(
        `UPDATE conversation_delete_requests
            SET status = 'expired', resolved_at = now(), updated_at = now()
          WHERE status = 'pending' AND created_at < now() - make_interval(days => $1)
          RETURNING conversation_id`,
        [MESSAGING_LIMITS.deleteRequestDays],
      ),
    );
    for (const row of expired) {
      const members = await this.access.memberIds(row.conversation_id);
      await this.events.publish(
        MESSAGING_CHANNELS.conversationUpdated,
        members,
        {
          conversationId: row.conversation_id,
          reason: 'delete_resolved',
        },
      );
    }
    return expired.length;
  }

  private async mustFindPending(
    conversationId: string,
  ): Promise<ConversationDeleteRequestEntity> {
    const pending = await this.requests.findOne({
      where: { conversationId, status: 'pending' },
    });
    if (!pending) notFound('Không có yêu cầu xóa lịch sử đang chờ.');
    return pending as ConversationDeleteRequestEntity;
  }

  private async resolve(
    id: string,
    status: 'cancelled' | 'declined',
  ): Promise<void> {
    const result = await this.requests.update(
      { id, status: 'pending' },
      { status, resolvedAt: new Date() },
    );
    if (!result.affected) conflict('Yêu cầu này đã được xử lý.');
  }

  private toResult(
    row: ConversationDeleteRequestEntity,
    viewerId: string,
  ): DeleteRequestResult {
    return {
      id: row.id,
      byMe: row.requesterId === viewerId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async notifyPeer(
    userId: string,
    peerId: string,
    conversationId: string,
    requestId: string,
  ): Promise<void> {
    const [actor, peer] = await Promise.all([
      this.users.findOne({ where: { id: userId } }),
      this.users.findOne({ where: { id: peerId } }),
    ]);
    const rootPath = peer?.role === UserRole.ADMIN ? '/admin' : '/app';
    void this.notifications
      .notify({
        userId: peerId,
        type: 'message.delete_request',
        link: `${rootPath}/messages/${conversationId}`,
        params: { actorName: actor?.displayName ?? 'Một người dùng' },
        actorId: userId,
        dedupeKey: `message.delete_request:${requestId}`,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Không gửi được thông báo: ${error instanceof Error ? error.message : 'không rõ'}`,
        );
      });
  }
}

/** Tin không có báo cáo mở: báo cáo mở được giữ lại làm bằng chứng. */
const NO_OPEN_REPORT = `NOT EXISTS (
  SELECT 1 FROM message_reports r
   WHERE r.conversation_id = m.conversation_id AND r.message_seq = m.seq AND r.status = 'open'
)`;
