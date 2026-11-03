import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { NotificationEntity } from './entities/notification.entity.js';
import type { NotificationType } from './notification.catalog.js';
import { NotificationsService } from './notification.service.js';

type SeedNote = {
  type: NotificationType;
  link: string;
  params?: Record<string, string>;
  dedupeKey: string;
};

@Injectable()
export class SeedNotificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedNotificationService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    @InjectRepository(NotificationEntity)
    private readonly rows: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    const user = await this.users.findOne({ where: { email: 'user@email.com' } });
    const admin = await this.users.findOne({ where: { email: 'admin@email.com' } });
    if (user) await this.seed(user.id, await this.userNotes());
    if (admin) await this.seed(admin.id, await this.adminNotes());
  }

  private async seed(userId: string, notes: SeedNote[]): Promise<void> {
    let changed = 0;
    for (const note of notes) {
      const existing = await this.rows.findOne({
        where: { userId, dedupeKey: note.dedupeKey },
      });
      if (existing) {
        if (!existing.deletedAt && existing.link !== note.link) {
          existing.link = note.link;
          await this.rows.save(existing);
          changed += 1;
        }
        continue;
      }
      await this.notifications.notify({
        userId,
        type: note.type,
        link: note.link,
        params: note.params,
        dedupeKey: note.dedupeKey,
        push: false,
      });
      changed += 1;
    }
    if (changed > 0) this.logger.log(`Đã bổ sung ${changed} thông báo mẫu.`);
  }

  private async userNotes(): Promise<SeedNote[]> {
    const reply = await this.postId('ho-tay');
    const mention = await this.postId('gia-nha');
    const feedback = await this.feedbackId('user@email.com');
    const order = await this.orderId('user@email.com');
    return [
      {
        type: 'follow.new',
        link: '/app/profile/@lan-anh',
        params: { actorName: 'Lan Anh' },
        dedupeKey: 'seed:follow:user',
      },
      {
        type: 'discussion.reply',
        link: reply ? `/app/feed/${reply}` : '/app/feed',
        params: { actorName: 'Minh Đức', preview: 'Nhà này gần hồ không?' },
        dedupeKey: 'seed:reply:user',
      },
      {
        type: 'discussion.mention',
        link: mention ? `/app/feed/${mention}` : '/app/feed',
        params: { actorName: 'Lan Anh', preview: 'Nhờ bạn xem giúp giá này' },
        dedupeKey: 'seed:mention:user',
      },
      {
        type: 'payment.succeeded',
        link: order ? `/app/payments/${order}` : '/app/payments',
        params: { preview: 'Gói dùng thử đã được ghi nhận' },
        dedupeKey: 'seed:payment:user',
      },
      {
        type: 'payment.failed',
        link: '/app/payments',
        params: { preview: 'Chưa nhận được khoản chuyển' },
        dedupeKey: 'seed:payment-failed:user',
      },
      {
        type: 'plan.expiring',
        link: '/app/plans',
        params: { preview: 'Còn 3 ngày' },
        dedupeKey: 'seed:plan:user',
      },
      {
        type: 'listing.approved',
        link: '/app/properties/nha-pho-ho-tay',
        params: { preview: 'Nhà phố view hồ Tây' },
        dedupeKey: 'seed:listing-ok:user',
      },
      {
        type: 'listing.rejected',
        link: '/app/properties/can-ho-bach-mai',
        params: { preview: 'Thiếu diện tích sử dụng' },
        dedupeKey: 'seed:listing-no:user',
      },
      {
        type: 'feedback.replied',
        link: feedback ? `/app/feedback/${feedback}` : '/app/feedback',
        params: { preview: 'Đã tái hiện được lỗi bộ lọc trên bản đồ' },
        dedupeKey: 'seed:feedback:user',
      },
      {
        type: 'security.new_login',
        link: '/app/profile',
        params: { preview: 'Trình duyệt trên máy này' },
        dedupeKey: 'seed:login:user',
      },
      {
        type: 'security.password_changed',
        link: '/app/profile',
        params: {},
        dedupeKey: 'seed:password:user',
      },
      {
        type: 'system.announcement',
        link: '/app/properties',
        params: { title: 'Tin rao mới quanh Hồ Tây', preview: 'Mở danh sách nhà đất để xem' },
        dedupeKey: 'seed:announce:user',
      },
    ];
  }

  private async adminNotes(): Promise<SeedNote[]> {
    const report = await this.postId('ngo-cu');
    const feedback = await this.feedbackId('lan-anh@email.com');
    const article = await this.articleId('ban-kinh-500-met');
    return [
      {
        type: 'admin.report.new',
        link: report ? `/admin/feed/${report}` : '/admin/feed',
        params: { preview: 'Bài trong chủ đề ngõ cũ' },
        dedupeKey: 'seed:report:admin',
      },
      {
        type: 'admin.feedback.new',
        link: feedback ? `/admin/feedback/${feedback}` : '/admin/feedback',
        params: { preview: 'Góp ý về ghi chú địa điểm' },
        dedupeKey: 'seed:feedback:admin',
      },
      {
        type: 'admin.reconciliation.mismatch',
        link: '/admin/reconciliation',
        params: { preview: 'Một khoản chưa khớp sao kê' },
        dedupeKey: 'seed:reconcile:admin',
      },
      {
        type: 'payment.succeeded',
        link: '/admin/payments',
        params: { preview: 'Có giao dịch mới cần xem' },
        dedupeKey: 'seed:payment:admin',
      },
      {
        type: 'system.announcement',
        link: article ? `/admin/blogs/${article}` : '/admin/blogs',
        params: { title: 'Bài viết cần rà lại', preview: 'Bán kính 500 mét' },
        dedupeKey: 'seed:announce:admin',
      },
      {
        type: 'follow.new',
        link: '/admin/profile/@nguoi-dung',
        params: { actorName: 'Người dùng' },
        dedupeKey: 'seed:profile:admin',
      },
    ];
  }

  private async postId(slug: string): Promise<string | null> {
    return this.one(
      `SELECT p.id FROM discussion_posts p
       INNER JOIN discussion_topics t ON t.id = p.topic_id
       WHERE t.slug = $1 AND p.root_id IS NULL AND p.deleted_at IS NULL
       ORDER BY p.created_at ASC
       LIMIT 1`,
      [slug],
    );
  }

  private async feedbackId(email: string): Promise<string | null> {
    return this.one(
      `SELECT f.id FROM feedbacks f
       INNER JOIN users u ON u.id = f.author_id
       WHERE u.email = $1 AND f.deleted_at IS NULL
       ORDER BY f.created_at ASC
       LIMIT 1`,
      [email],
    );
  }

  private async orderId(email: string): Promise<string | null> {
    return this.one(
      `SELECT o.id FROM payment_orders o
       INNER JOIN users u ON u.id = o.user_id
       WHERE u.email = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [email],
    );
  }

  private async articleId(slug: string): Promise<string | null> {
    return this.one(
      `SELECT id FROM articles WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
      [slug],
    );
  }

  private async one(sql: string, params: string[]): Promise<string | null> {
    const rows = (await this.dataSource.query(sql, params)) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  }
}
