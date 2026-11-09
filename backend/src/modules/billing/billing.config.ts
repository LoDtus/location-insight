import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseTestPrice } from './billing.constants.js';

@Injectable()
export class BillingConfig implements OnModuleInit {
  private readonly logger = new Logger(BillingConfig.name);

  constructor(private readonly config: ConfigService) {}

  /** Kiểm tra BILLING_TEST_PRICE_VND ngay khi khởi động: sai thì dừng, đang bật thì cảnh báo để không quên tắt. */
  onModuleInit(): void {
    const price = this.testPriceVnd;
    if (price !== null) {
      this.logger.warn(
        `Đang dùng GIÁ THỬ: mọi gói và lượt định giá thu ${price} VND (BILLING_TEST_PRICE_VND). Để trống biến này để dùng giá thật.`,
      );
    }
  }

  /** null: dùng bảng giá thật trong BILLING_CATALOG. */
  get testPriceVnd(): number | null {
    return parseTestPrice(this.config.get<string>('BILLING_TEST_PRICE_VND'));
  }

  get webhookApiKey(): string {
    return this.config.get<string>('SEPAY_WEBHOOK_API_KEY') || '';
  }

  get hmacSecret(): string {
    return this.config.get<string>('SEPAY_WEBHOOK_HMAC_SECRET') || '';
  }

  get accountNumber(): string {
    return (this.config.get<string>('SEPAY_ACCOUNT_NUMBER') || '').replace(
      /\s/g,
      '',
    );
  }

  get bankCode(): string {
    return this.config.get<string>('SEPAY_BANK_CODE') || '';
  }

  get accountHolder(): string {
    return this.config.get<string>('SEPAY_ACCOUNT_HOLDER') || '';
  }

  get paymentPrefix(): string {
    const raw = (this.config.get<string>('SEPAY_PAYMENT_PREFIX') || 'DT')
      .trim()
      .toUpperCase();
    return /^[A-Z]{2,5}$/.test(raw) ? raw : 'DT';
  }

  get ready(): boolean {
    return Boolean(this.accountNumber && this.bankCode && this.accountHolder);
  }
}
