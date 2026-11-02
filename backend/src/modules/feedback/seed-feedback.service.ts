import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity.js';
import { FeedbackReplyEntity } from './entities/feedback-reply.entity.js';
import { FeedbackEntity } from './entities/feedback.entity.js';

const H = 60 * 60 * 1000;

const SEEDS = [
  {
    email: 'user@email.com',
    category: 'bug' as const,
    description: 'Trên bản đồ, khi lọc theo khoảng giá rồi bấm vào một tin thì bộ lọc bị đặt lại. Mình dùng Chrome trên Windows.',
    status: 'in_progress' as const,
    ago: 30 * H,
    replies: [
      { role: 'admin' as const, ago: 20 * H, body: 'Cảm ơn bạn đã báo lỗi. Chúng tôi đã tái hiện được và đang sửa.' },
    ],
    unread: true,
  },
  {
    email: 'lan-anh@email.com',
    category: 'idea' as const,
    description: 'Mong có thể lưu nhiều ghi chú cho cùng một địa điểm, và lọc ghi chú theo ngày. Hiện tại mỗi nơi chỉ có một ô ghi chú.',
    status: 'open' as const,
    ago: 8 * H,
    replies: [],
    unread: false,
  },
  {
    email: 'minh-duc@email.com',
    category: 'question' as const,
    description: 'Khung giá định giá được cập nhật theo chu kỳ nào? Mình thấy số liệu tháng này khác tuần trước khá nhiều.',
    status: 'resolved' as const,
    ago: 3 * 24 * H,
    replies: [
      { role: 'admin' as const, ago: 2 * 24 * H + 12 * H, body: 'Khung giá được tính lại hằng ngày từ các tin rao mới. Tuần vừa rồi có nhiều tin mới ở khu này nên số liệu dịch chuyển.' },
      { role: 'user' as const, ago: 2 * 24 * H, body: 'Mình hiểu rồi, cảm ơn bạn.' },
    ],
    unread: false,
  },
];

/** Góp ý mẫu cho môi trường dev, chạy một lần khi chưa có góp ý nào. */
@Injectable()
export class SeedFeedbackService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedFeedbackService.name);

  constructor(
    @InjectRepository(FeedbackEntity) private readonly feedbacks: Repository<FeedbackEntity>,
    @InjectRepository(FeedbackReplyEntity) private readonly replies: Repository<FeedbackReplyEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    try {
      if ((await this.feedbacks.count()) > 0) return;
      const emails = [...SEEDS.map((item) => item.email), 'admin@email.com'];
      const people = await this.users.find({ where: { email: In(emails) } });
      const byEmail = new Map(people.map((user) => [user.email, user]));
      const admin = byEmail.get('admin@email.com');
      if (!admin) return;
      const now = Date.now();
      for (const seed of SEEDS) {
        const author = byEmail.get(seed.email);
        if (!author) continue;
        const last = seed.replies.at(-1);
        const activity = new Date(now - (last?.ago ?? seed.ago));
        const feedback = await this.feedbacks.save(
          this.feedbacks.create({
            authorId: author.id,
            category: seed.category,
            description: seed.description,
            status: seed.status,
            replyCount: seed.replies.length,
            lastReplyBy: last?.role ?? null,
            lastActivityAt: activity,
            userReadAt: seed.unread ? new Date(now - seed.ago) : activity,
          }),
        );
        for (const reply of seed.replies) {
          const saved = await this.replies.save(
            this.replies.create({
              feedbackId: feedback.id,
              authorId: reply.role === 'admin' ? admin.id : author.id,
              authorRole: reply.role,
              body: reply.body,
            }),
          );
          await this.replies.query(`UPDATE feedback_replies SET created_at = $2 WHERE id = $1`, [
            saved.id,
            new Date(now - reply.ago),
          ]);
        }
        await this.feedbacks.query(`UPDATE feedbacks SET created_at = $2 WHERE id = $1`, [
          feedback.id,
          new Date(now - seed.ago),
        ]);
      }
      this.logger.log('Đã tạo góp ý mẫu.');
    } catch (error) {
      this.logger.warn(`Chưa tạo được góp ý mẫu: ${error instanceof Error ? error.message : 'không rõ'}`);
    }
  }
}
