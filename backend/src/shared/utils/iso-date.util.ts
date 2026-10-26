const ISO_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})?$/;

export function toUtcIsoString(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new Error('Invalid date');
  }

  return value.toISOString();
}

export function serializeDates<T>(
  value: T,
  seen: WeakSet<object> = new WeakSet(),
): T {
  if (value instanceof Date) {
    return (Number.isNaN(value.getTime()) ? null : value.toISOString()) as T;
  }

  if (typeof value === 'string') {
    if (!ISO_DATE_TIME.test(value)) return value;
    const parsed = new Date(value);
    return (Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()) as T;
  }

  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Uint8Array) return value;
  if (seen.has(value)) return value;

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serializeDates(item, seen)) as T;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = serializeDates(item, seen);
  }

  return output as T;
}
