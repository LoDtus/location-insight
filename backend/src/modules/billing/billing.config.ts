import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BillingConfig {
  constructor(private readonly config: ConfigService) {}

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
