/** typeorm trả `[rows, count]` cho UPDATE/DELETE ... RETURNING ở một số phiên bản, và `rows` ở phiên bản khác. */
export function rowsOf<T>(raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
    return raw[0] as T[];
  }
  return raw as T[];
}
