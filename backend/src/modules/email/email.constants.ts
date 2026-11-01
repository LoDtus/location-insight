export const EMAIL_CATEGORIES = ['security', 'transactional', 'notification', 'marketing'] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

/** Danh mục người dùng được phép tắt. */
export const OPTIONAL_CATEGORIES = ['notification', 'marketing'] as const;
export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];

export const EMAIL_STATUSES = [
  'queued',
  'sending',
  'sent',
  'dead',
  'suppressed',
  'skipped',
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_LOCALES = ['vi', 'en'] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];
export const DEFAULT_LOCALE: EmailLocale = 'vi';

export const EMAIL_LIMITS = {
  subjectMax: 200,
  bodyHtmlMax: 50_000,
  bodyTextMax: 20_000,
  /** Số lần gửi tối đa (kể cả lần đầu). */
  maxAttempts: 5,
  /** Backoff giữa các lần thử (giây): sau lần 1,2,3,4. */
  backoffSeconds: [60, 5 * 60, 30 * 60, 2 * 60 * 60, 6 * 60 * 60],
  leaseSeconds: 120,
  batch: 20,
  concurrency: 5,
  pollMs: 2000,
  perRecipientPerHour: 20,
  perRecipientTemplatePerHour: 5,
  testPerHour: 10,
  contentRetentionDays: 7,
  rowRetentionDays: 90,
} as const;

export const SUPPRESSION_REASONS = ['hard_bounce', 'complaint', 'manual'] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];
