import type { Type } from '@nestjs/common';
import { SeedAccountService } from '../modules/auth/seed-account.service.js';
import { SeedArticleService } from '../modules/articles/seed-article.service.js';
import { SeedBillingService } from '../modules/billing/seed-billing.service.js';
import { SeedDiscussionService } from '../modules/discussions/seed-discussion.service.js';
import { SeedFeedbackService } from '../modules/feedback/seed-feedback.service.js';
import { SeedFollowService } from '../modules/follow/seed-follow.service.js';
import { MessagingSchemaService } from '../modules/messaging/messaging-schema.service.js';
import { SeedMessagingService } from '../modules/messaging/seed-messaging.service.js';
import { SeedNotificationService } from '../modules/notification/seed-notification.service.js';

export interface SeedStep {
  name: string;
  provider: Type<unknown>;
}

/**
 * Thứ tự chạy lại các bước dựng dữ liệu sau khi xóa database. Tài khoản phải đi trước vì các seed khác
 * tra người dùng theo email. `MessagingSchemaService` bổ sung CHECK/khóa ngoại mà `synchronize` không tạo.
 *
 * THÊM service seed mới (tệp `seed-*.service.ts`) thì PHẢI thêm vào đây; bài kiểm tra
 * `dev-reset.seed-order.spec.ts` sẽ thất bại nếu thiếu.
 */
export const SEED_STEPS: readonly SeedStep[] = [
  { name: 'accounts', provider: SeedAccountService },
  { name: 'billing', provider: SeedBillingService },
  { name: 'articles', provider: SeedArticleService },
  { name: 'discussions', provider: SeedDiscussionService },
  { name: 'messaging-schema', provider: MessagingSchemaService },
  { name: 'messaging', provider: SeedMessagingService },
  { name: 'feedback', provider: SeedFeedbackService },
  { name: 'follow', provider: SeedFollowService },
  { name: 'notification', provider: SeedNotificationService },
];
