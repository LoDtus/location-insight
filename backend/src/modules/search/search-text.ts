export const MAX_QUERY_CHARS = 120;
export const MAX_QUERY_TERMS = 8;
export const MIN_QUERY_CHARS = 2;
export const MAX_PAGE_SIZE = 50;
export const MAX_RESULT_WINDOW = 1000;

/**
 * Chuẩn hóa chữ tìm kiếm (FR-13): NFC, bỏ ký tự điều khiển, gộp khoảng trắng,
 * cắt còn tối đa 120 ký tự và 8 từ. Trả null nếu còn dưới 2 ký tự: không dùng ES.
 */
export function normalizeQuery(raw: string): string | null {
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_CHARS);
  const text = cleaned.split(' ').slice(0, MAX_QUERY_TERMS).join(' ').trim();
  return text.length >= MIN_QUERY_CHARS ? text : null;
}

/** Ép phân trang vào giới hạn: size ≤ 50, from + size ≤ 1000. */
export function clampPage(page: { size: number; from: number }): {
  size: number;
  from: number;
} {
  const size = Math.min(Math.max(Math.floor(page.size) || 1, 1), MAX_PAGE_SIZE);
  const from = Math.min(
    Math.max(Math.floor(page.from) || 0, 0),
    MAX_RESULT_WINDOW - size,
  );
  return { size, from };
}
