const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function quotaDayKey(now = Date.now()): string {
  const shifted = new Date(now + VN_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function nextQuotaReset(now = Date.now()): Date {
  const shifted = new Date(now + VN_OFFSET_MS);
  const nextMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1,
  );
  return new Date(nextMidnight - VN_OFFSET_MS);
}

export function quotaTtlSeconds(now = Date.now()): number {
  const reset = nextQuotaReset(now).getTime();
  return Math.max(60, Math.ceil((reset - now) / 1000) + 60 * 60);
}
