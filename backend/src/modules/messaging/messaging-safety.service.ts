import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { UserEntity, UserStatus } from '../auth/entities/user.entity.js';
import { Principal } from '../rbac/authorization.types.js';
import { AdminAuditLogEntity } from '../rbac/entities/admin-audit-log.entity.js';
import {
  AdminReportsQueryDto,
  PreferencesDto,
  ReportMessageDto,
  ResolveReportDto,
} from './dto/messaging.dto.js';
import { FollowService } from '../follow/follow.service.js';
import { MessagingAccessService, Preferences } from './messaging-access.service.js';
import { MessagingConversationsService } from './messaging-conversations.service.js';
import { conflict, invalid, notFound } from './messaging-errors.js';
import { MessagingEventsService } from './messaging-events.service.js';
import { MessagingPresenterService } from './messaging-presenter.service.js';
import { MessagingRateLimitService } from './messaging-rate-limit.service.js';
import { escapeLike, readCursor, writeCursor } from './messaging-rules.js';
import { cleanLine } from './messaging-text.js';
import { MESSAGING_CHANNELS, MESSAGING_LIMITS } from './messaging.constants.js';
import { ConversationParticipantEntity } from './entities/conversation-participant.entity.js';
import { MessageAttachmentEntity } from './entities/message-attachment.entity.js';
import {
  MessageReportEntity,
  SnapshotMessage,
} from './entities/message-report.entity.js';
import { MessageEntity } from './entities/message.entity.js';
import { MessagingPreferenceEntity } from './entities/messaging-preference.entity.js';
import { UserBlockEntity } from './entities/user-block.entity.js';

const ADMIN_PAGE = 20;

@Injectable()
export class MessagingSafetyService {
  constructor(
    private readonly access: MessagingAccessService,
    private readonly presenter: MessagingPresenterService,
    private readonly events: MessagingEventsService,
    private readonly rate: MessagingRateLimitService,
    private readonly conversations: MessagingConversationsService,
    private readonly storage: StorageService,
    private readonly follows: FollowService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(UserBlockEntity)
    private readonly blocks: Repository<UserBlockEntity>,
    @InjectRepository(MessagingPreferenceEntity)
    private readonly preferences: Repository<MessagingPreferenceEntity>,
    @InjectRepository(ConversationParticipantEntity)
    private readonly participants: Repository<ConversationParticipantEntity>,
    @InjectRepository(MessageEntity)
    private readonly messages: Repository<MessageEntity>,
    @InjectRepository(MessageAttachmentEntity)
    private readonly attachments: Repository<MessageAttachmentEntity>,
    @InjectRepository(MessageReportEntity)
    private readonly reports: Repository<MessageReportEntity>,
    @InjectRepository(AdminAuditLogEntity)
    private readonly audits: Repository<AdminAuditLogEntity>,
  ) {}

  getPreferences(userId: string): Promise<Preferences> {
    return this.access.preferencesOf(userId);
  }

  async updatePreferences(userId: string, input: PreferencesDto): Promise<Preferences> {
    const current = await this.access.preferencesOf(userId);
    const next: Preferences = {
      whoCanMessage: input.whoCanMessage ?? current.whoCanMessage,
      showActivityStatus: input.showActivityStatus ?? current.showActivityStatus,
      sendReadReceipts: input.sendReadReceipts ?? current.sendReadReceipts,
    };
    await this.preferences.save(this.preferences.create({ userId, ...next }));
    return next;
  }

  async listBlocks(userId: string) {
    const rows = await this.blocks.find({ where: { blockerId: userId }, order: { createdAt: 'DESC' } });
    const people = await this.presenter.people(rows.map((row) => row.blockedId));
    return { items: rows.map((row) => people.get(row.blockedId)).filter(Boolean) };
  }

  async block(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) invalid('Không thể chặn chính mình.');
    await this.blocks.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id, created_at) VALUES ($1, $2, now())
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [userId, targetId],
    );
    // Chặn xóa theo dõi hai chiều (011-follow).
    await this.follows.removeBetween(userId, targetId);
    const hidden = await this.participants.query(
      `UPDATE conversation_participants p SET hidden_at = now()
       FROM conversation_participants o
       WHERE p.user_id = $1 AND o.user_id = $2 AND p.conversation_id = o.conversation_id
       RETURNING p.conversation_id`,
      [userId, targetId],
    );
    const ids = rowsOfIds(hidden);
    await this.conversations.invalidateUnread([userId, targetId]);
    for (const conversationId of ids) {
      await this.events.publish(MESSAGING_CHANNELS.conversationUpdated, [userId], {
        conversationId,
        reason: 'blocked',
      });
    }
    await this.events.publish(MESSAGING_CHANNELS.unread, [userId], {});
  }

  async unblock(userId: string, targetId: string): Promise<void> {
    await this.blocks.delete({ blockerId: userId, blockedId: targetId });
    await this.events.publish(MESSAGING_CHANNELS.conversationUpdated, [userId], {
      conversationId: null,
      reason: 'unblocked',
    });
  }

  /** Tìm người để nhắn: tiền tố tên, tối đa 10, loại người chặn mình hoặc không nhận tin (I3). */
  async searchRecipients(userId: string, query: string) {
    await this.rate.consume('search', `user_${userId}`);
    const q = cleanLine(query);
    if (q.length < 2) invalid('Nhập ít nhất 2 ký tự.');
    const like = `${escapeLike(q.toLowerCase())}%`;
    const rows = await this.users
      .createQueryBuilder('u')
      .where('u.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('u.id <> :me', { me: userId })
      .andWhere(
        "(lower(u.displayName) LIKE :like ESCAPE '\\' OR lower(u.username) LIKE :like ESCAPE '\\')",
        { like },
      )
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = u.id AND b.blocked_id = :me)',
      )
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM user_blocks b2 WHERE b2.blocker_id = :me AND b2.blocked_id = u.id)',
      )
      .andWhere(
        "NOT EXISTS (SELECT 1 FROM messaging_preferences mp WHERE mp.user_id = u.id AND mp.who_can_message = 'nobody')",
      )
      .orderBy('u.displayName', 'ASC')
      .take(MESSAGING_LIMITS.searchMax)
      .getMany();
    return {
      items: rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      })),
    };
  }

  async report(userId: string, conversationId: string, messageId: string, input: ReportMessageDto) {
    const m = await this.access.membership(userId, conversationId);
    await this.rate.consume('report', `user_${userId}`);
    const target = await this.messages.findOne({ where: { conversationId, id: messageId } });
    if (!target || target.seq <= m.me.clearedBeforeSeq) notFound('Không tìm thấy tin nhắn.');
    if (target.senderId === userId) invalid('Không thể báo cáo tin của chính mình.');
    const duplicate = await this.reports.findOne({
      where: { conversationId, messageSeq: target.seq, reporterId: userId },
    });
    if (duplicate) conflict('Bạn đã báo cáo tin này.');

    const radius = MESSAGING_LIMITS.reportContextRadius;
    const around = await this.messages
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId })
      .andWhere('m.seq BETWEEN :from AND :to', {
        from: Math.max(m.me.clearedBeforeSeq + 1, target.seq - radius),
        to: target.seq + radius,
      })
      .orderBy('m.seq', 'ASC')
      .getMany();
    const people = await this.presenter.people(around.map((row) => row.senderId));
    const files = await this.attachments.find({
      where: { conversationId, status: 'ready' },
    });
    const snapshot: SnapshotMessage[] = around.map((row) => ({
      seq: row.seq,
      senderId: row.senderId,
      senderName: people.get(row.senderId)?.displayName ?? '',
      kind: row.kind,
      body: row.status === 'visible' ? row.body : '',
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      reported: row.seq === target.seq,
      attachmentIds: files
        .filter((file) => file.messageSeq === row.seq)
        .map((file) => file.id),
    }));
    await this.reports.save(
      this.reports.create({
        conversationId,
        messageSeq: target.seq,
        reporterId: userId,
        reportedUserId: target.senderId,
        reasonCode: input.reasonCode,
        note: input.note ? cleanLine(input.note) : null,
        contextSnapshot: snapshot,
        status: 'open',
      }),
    );
  }

  async listReports(query: AdminReportsQueryDto) {
    const qb = this.reports
      .createQueryBuilder('r')
      .where('r.status = :status', { status: query.status ?? 'open' })
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .take(ADMIN_PAGE + 1);
    const point = readCursor(query.cursor, 2);
    if (point) {
      qb.andWhere('(r.createdAt < :at OR (r.createdAt = :at AND r.id < :id))', {
        at: new Date(point[0] as string),
        id: point[1],
      });
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > ADMIN_PAGE;
    const slice = hasMore ? rows.slice(0, ADMIN_PAGE) : rows;
    const people = await this.presenter.people(
      slice.flatMap((row) => [row.reporterId, row.reportedUserId]),
    );
    const attachmentIds = [
      ...new Set(slice.flatMap((row) => row.contextSnapshot.flatMap((item) => item.attachmentIds))),
    ];
    const files = attachmentIds.length
      ? await this.attachments.find({ where: { id: In(attachmentIds) } })
      : [];
    const urls = new Map<string, string>();
    await Promise.all(
      files.map(async (file) => {
        if (await this.storage.objectSize(file.objectKey)) {
          urls.set(file.id, await this.storage.getPresignedUrl(file.objectKey, 600));
        }
      }),
    );
    const last = slice.at(-1);
    return {
      items: slice.map((row) => ({
        id: row.id,
        reasonCode: row.reasonCode,
        note: row.note,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        reporter: people.get(row.reporterId),
        reported: people.get(row.reportedUserId),
        messageSeq: row.messageSeq,
        context: row.contextSnapshot.map((item) => ({
          ...item,
          attachments: item.attachmentIds.flatMap((id) => (urls.has(id) ? [{ id, url: urls.get(id) }] : [])),
        })),
      })),
      nextCursor: hasMore && last ? writeCursor([last.createdAt.toISOString(), last.id]) : null,
    };
  }

  async resolveReport(actor: Principal, reportId: string, input: ResolveReportDto, ip: string | null) {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) notFound('Không tìm thấy báo cáo.');
    if (report.status !== 'open') conflict('Báo cáo đã được xử lý.');
    const reason = cleanLine(input.reason);
    if (reason.length < 5) invalid('Lý do cần ít nhất 5 ký tự.');

    if (input.action === 'hide_message') {
      await this.messages.update(
        { conversationId: report.conversationId, seq: report.messageSeq },
        { status: 'hidden' },
      );
      const members = await this.access.memberIds(report.conversationId);
      await this.events.publish(MESSAGING_CHANNELS.messageUpdated, members, {
        conversationId: report.conversationId,
        seq: report.messageSeq,
        change: 'hidden',
      });
    }
    report.status = input.action === 'dismiss' ? 'dismissed' : 'actioned';
    report.resolvedBy = actor.userId;
    report.resolvedAt = new Date();
    await this.reports.save(report);
    await this.audits.save(
      this.audits.create({
        actorId: actor.userId,
        actorType: 'admin',
        action: input.action === 'dismiss' ? 'message_report_dismiss' : 'message_hide',
        targetType: 'message_report',
        targetId: report.id,
        before: { status: 'open' },
        after: { status: report.status, conversationId: report.conversationId, seq: report.messageSeq },
        reason,
        ipAddress: ip,
        sessionId: actor.sessionId,
      }),
    );
    return { id: report.id, status: report.status };
  }
}

function rowsOfIds(raw: unknown): string[] {
  const list = Array.isArray(raw) && Array.isArray(raw[0]) ? (raw[0] as unknown[]) : (raw as unknown[]);
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => (row as { conversation_id?: string }).conversation_id)
    .filter((id): id is string => typeof id === 'string');
}
