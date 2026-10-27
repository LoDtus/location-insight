import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { RedisService } from '../../integrations/redis/redis.service.js';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from '../rbac/entities/subscription.entity.js';
import {
  BILLING_LIMITS,
  addCalendarDays,
  vnParts,
} from './billing.constants.js';
import {
  BillingNoticeEntity,
  BillingNoticeType,
} from './entities/billing-notice.entity.js';
import { PaymentOrderEntity } from './entities/payment-order.entity.js';
import { isUniqueViolation } from './billing.service.js';

@Injectable()
export class BillingMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BillingMaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(PaymentOrderEntity)
    private readonly orders: Repository<PaymentOrderEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptions: Repository<SubscriptionEntity>,
    @InjectRepository(BillingNoticeEntity)
    private readonly notices: Repository<BillingNoticeEntity>,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) => {
        this.logger.warn(`Bảo trì thanh toán lỗi: ${String(error)}`);
      });
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    await this.expireOrders(now);
    await this.remind(now);
  }

  private async expireOrders(now: Date): Promise<void> {
    await this.orders.update(
      { status: 'pending', expiresAt: LessThan(now) },
      { status: 'expired' },
    );
  }

  private async remind(now: Date): Promise<void> {
    const today = vnParts(now);
    if (today.hour !== BILLING_LIMITS.renewalHourVn) return;
    const key = `billing:renewal:${today.ymd}`;
    const claimed = await this.redis.getClient().set(key, '1', 'EX', 36 * 60 * 60, 'NX');
    if (claimed !== 'OK') return;

    const horizon = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const rows = await this.subscriptions.find({
      where: [
        {
          status: SubscriptionStatus.ACTIVE,
          endedAt: IsNull(),
          periodEnd: MoreThan(now),
        },
        {
          status: SubscriptionStatus.CANCELED,
          endedAt: IsNull(),
          periodEnd: MoreThan(now),
        },
      ],
    });
    const targets = new Map<string, BillingNoticeType>([
      [addCalendarDays(today.ymd, 7), 'renewal_7d'],
      [addCalendarDays(today.ymd, 1), 'renewal_1d'],
      [today.ymd, 'renewal_due'],
    ]);
    for (const row of rows) {
      if (row.periodEnd.getTime() > horizon.getTime()) continue;
      const type = targets.get(vnParts(row.periodEnd).ymd);
      if (!type) continue;
      try {
        await this.notices.save(
          this.notices.create({
            userId: row.userId,
            type,
            subscriptionId: row.id,
            orderId: null,
            title: 'Gói sắp hết hạn',
            body: 'Gói không tự trừ tiền. Hãy gia hạn nếu bạn muốn giữ quyền hiện tại.',
            readAt: null,
          }),
        );
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
  }
}
