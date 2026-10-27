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

export function billingPrice(
  kind: 'subscription' | 'valuation_credit',
  plan: 'unlimited' | 'valued' | undefined,
  cycle: 'month' | 'year' | undefined,
): number | null {
  if (kind === 'valuation_credit') return BILLING_CATALOG.valuationCreditVnd;
  const row = BILLING_CATALOG.plans.find((item) => item.code === plan);
  if (!row || (cycle !== 'month' && cycle !== 'year')) return null;
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
