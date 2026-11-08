import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { timingSafeEqual, createHmac } from 'node:crypto';
import { Request } from 'express';
import { DataSource, EntityManager } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { BILLING_LIMITS } from './billing.constants.js';
import { BillingConfig } from './billing.config.js';
import { BillingService, isUniqueViolation } from './billing.service.js';
import { BillingNoticeEntity } from './entities/billing-notice.entity.js';
import { PaymentOrderEntity } from './entities/payment-order.entity.js';
import { PaymentTransactionEntity } from './entities/payment-transaction.entity.js';
import { decideIncoming } from './payment-decision.js';

interface SepayPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  code: string | null;
  content: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  referenceCode: string | null;
  raw: Record<string, unknown>;
}

@Injectable()
export class SepayWebhookService {
  private readonly logger = new Logger(SepayWebhookService.name);

  constructor(
    private readonly config: BillingConfig,
    private readonly redis: RedisService,
    private readonly dataSource: DataSource,
    private readonly billing: BillingService,
  ) {}

  async receive(request: RawBodyRequest<Request>): Promise<{ success: true }> {
    this.assertKey(request.header('authorization') || '');
    this.assertHmac(request.rawBody, request.header('x-sepay-signature'));
    const payload = readPayload(request.body);
    if (!payload) {
      this.logger.warn('Webhook SePay thiếu trường bắt buộc, bỏ qua.');
      return { success: true };
    }

    const lockKey = `billing:lock:${payload.id}`;
    const locked = await this.redis
      .getClient()
      .set(lockKey, '1', 'EX', BILLING_LIMITS.webhookLockSeconds, 'NX');
    if (locked !== 'OK') {
      throw new BusinessException(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Webhook đang được xử lý.',
        null,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let userId: string | null = null;
    try {
      userId = await this.dataSource.transaction((manager) =>
        this.apply(manager, payload),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    } finally {
      await this.redis.getClient().del(lockKey);
    }
    if (userId) await this.billing.invalidate(userId);
    return { success: true };
  }

  private async apply(
    manager: EntityManager,
    payload: SepayPayload,
  ): Promise<string | null> {
    const existing = await manager.findOne(PaymentTransactionEntity, {
      where: { sepayId: String(payload.id) },
    });
    if (existing) return null;

    const code = payload.code?.toUpperCase() || null;
    const order = code
      ? await manager.findOne(PaymentOrderEntity, { where: { code } })
      : null;
    // Tài khoản ảo (VA): SePay gửi số tài khoản chính ở accountNumber và số VA ở subAccount.
    // Cấu hình có thể là số tài khoản chính hoặc số VA mà người trả chuyển tới.
    const configured = this.normalize(this.config.accountNumber);
    const accountMatches =
      this.normalize(payload.accountNumber) === configured ||
      (payload.subAccount !== null &&
        this.normalize(payload.subAccount) === configured);
    const result = decideIncoming({
      transferType: payload.transferType,
      code,
      order: order
        ? {
            status: order.status,
            amountVnd: order.amountVnd,
            expiresAt: order.expiresAt,
          }
        : null,
      transferAmount: payload.transferAmount,
      accountMatches,
      now: new Date(),
    });

    const transaction = manager.create(PaymentTransactionEntity, {
      sepayId: String(payload.id),
      orderId: order?.id ?? null,
      gateway: payload.gateway,
      accountNumber: payload.accountNumber,
      subAccount: payload.subAccount,
      code,
      content: payload.content.slice(0, 255),
      transferType: payload.transferType,
      transferAmount: payload.transferAmount,
      referenceCode: payload.referenceCode,
      transactionAt: parseVnTime(payload.transactionDate),
      applyResult: result,
      raw: payload.raw,
    });
    await manager.save(transaction);
    if (!order) return null;

    if (result === 'fulfilled') {
      await this.billing.fulfillOrder(
        manager,
        order,
        new Date(),
        payload.transferAmount,
      );
      return order.userId;
    }
    if (result === 'underpaid') {
      order.receivedVnd = Math.max(order.receivedVnd, payload.transferAmount);
      await manager.save(order);
      await manager.save(
        manager.create(BillingNoticeEntity, {
          userId: order.userId,
          type: 'payment_underpaid',
          subscriptionId: null,
          orderId: order.id,
          title: 'Chuyển khoản còn thiếu',
          body: `Đã nhận ${payload.transferAmount} đồng cho ${order.code}. Còn thiếu ${Math.max(order.amountVnd - order.receivedVnd, 0)} đồng.`,
          readAt: null,
        }),
      );
      return null;
    }
    if (result === 'late' || result === 'needs_review') {
      order.status = 'needs_review';
      order.receivedVnd = Math.max(order.receivedVnd, payload.transferAmount);
      await manager.save(order);
      await manager.save(
        manager.create(BillingNoticeEntity, {
          userId: order.userId,
          type: 'payment_review',
          subscriptionId: null,
          orderId: order.id,
          title: 'Khoản thanh toán cần đối soát',
          body: `Tiền của mã ${order.code} chưa được mở quyền. Hãy giữ ủy nhiệm chi.`,
          readAt: null,
        }),
      );
    }
    return null;
  }

  private assertKey(header: string): void {
    const expected = this.config.webhookApiKey;
    const presented = header.startsWith('Apikey ') ? header.slice(7).trim() : '';
    if (!expected || !presented || !safeEqual(presented, expected)) {
      throw new BusinessException(
        ErrorCode.UNAUTHORIZED,
        'Webhook không hợp lệ.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private assertHmac(raw: Buffer | undefined, signature: string | undefined): void {
    const secret = this.config.hmacSecret;
    if (!secret) return;
    const digest = createHmac('sha256', secret)
      .update(raw ?? Buffer.alloc(0))
      .digest('hex');
    if (!signature || !safeEqual(signature.trim().toLowerCase(), digest)) {
      throw new BusinessException(
        ErrorCode.UNAUTHORIZED,
        'Chữ ký webhook không hợp lệ.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private normalize(value: string): string {
    return value.replace(/\s/g, '').toUpperCase();
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readPayload(body: unknown): SepayPayload | null {
  if (!body || typeof body !== 'object') return null;
  const row = body as Record<string, unknown>;
  const id = Number(row.id);
  const transferAmount = Number(row.transferAmount);
  const transferType = row.transferType === 'out' ? 'out' : row.transferType === 'in' ? 'in' : null;
  if (!Number.isInteger(id) || id <= 0 || !transferType) return null;
  if (!Number.isInteger(transferAmount) || transferAmount < 0) return null;
  return {
    id,
    gateway: String(row.gateway || ''),
    transactionDate: String(row.transactionDate || ''),
    accountNumber: String(row.accountNumber || ''),
    subAccount: row.subAccount ? String(row.subAccount) : null,
    code: row.code === null || row.code === undefined || row.code === '' ? null : String(row.code),
    content: String(row.content || ''),
    transferType,
    transferAmount,
    referenceCode: row.referenceCode ? String(row.referenceCode) : null,
    raw: row,
  };
}

function parseVnTime(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return new Date();
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 7,
      Number(minute),
      Number(second),
    ),
  );
}
