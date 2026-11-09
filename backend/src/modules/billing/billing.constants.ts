export const BILLING_CATALOG = {
  currency: 'VND' as const,
  valuationCreditVnd: 10_000,
  orderTtlMinutes: 30,
  plans: [
    { code: 'unlimited' as const, monthVnd: 30_000, yearVnd: 300_000 },
    { code: 'valued' as const, monthVnd: 60_000, yearVnd: 600_000 },
  ],
  periodDays: { month: 30, year: 365 },
};

export const BILLING_LIMITS = {
  checkoutPerHour: 10,
  checkoutWindowSeconds: 60 * 60,
  webhookLockSeconds: 60,
  renewalHourVn: 8,
} as const;

/**
 * Giá thử từ biến BILLING_TEST_PRICE_VND. Để trống thì null (dùng bảng giá thật).
 * Chỉ nhận số nguyên từ 1.000 đến 1.000.000; giá trị khác ném lỗi để backend không khởi động với cấu hình sai.
 */
export function parseTestPrice(raw: string | undefined): number | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const value = /^\d+$/.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 1_000_000) {
    throw new Error(
      `BILLING_TEST_PRICE_VND="${text}" không hợp lệ: cần số nguyên từ 1000 đến 1000000, hoặc để trống để dùng giá thật.`,
    );
  }
  return value;
}

/** Giá phải trả. Khi đặt giá thử (testPriceVnd khác null), mọi gói, kỳ và lượt định giá hợp lệ đều trả số này. */
export function billingPrice(
  kind: 'subscription' | 'valuation_credit',
  plan: 'unlimited' | 'valued' | undefined,
  cycle: 'month' | 'year' | undefined,
  testPriceVnd: number | null = null,
): number | null {
  if (kind === 'valuation_credit') {
    return testPriceVnd ?? BILLING_CATALOG.valuationCreditVnd;
  }
  const row = BILLING_CATALOG.plans.find((item) => item.code === plan);
  if (!row || (cycle !== 'month' && cycle !== 'year')) return null;
  if (testPriceVnd !== null) return testPriceVnd;
  return cycle === 'year' ? row.yearVnd : row.monthVnd;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function vnParts(date: Date): { ymd: string; hour: number } {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return {
    ymd: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
  };
}

export function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}
