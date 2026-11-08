import { createHash } from 'node:crypto';

/**
 * Tương tác mẫu (lượt đọc theo ngày, bình luận, bình chọn) cho bài seed ở máy dev, để các mục Nổi bật, Được quan tâm
 * và Đề xuất của /bai-viet có số liệu khác nhau giữa các bài. Thuần hàm và tất định theo slug: chạy lại cho cùng kết quả.
 */

const DAY_MS = 86_400_000;

/** Số giả ngẫu nhiên tất định trong [0, 1) từ một chuỗi. */
export function seededUnit(key: string): number {
  return createHash('sha256').update(key).digest().readUInt32BE(0) / 2 ** 32;
}

/** Mức "được chú ý" của một bài trong [0, 1]: lệch mạnh để có vài bài nổi hẳn (giống phân phối thật). */
export function seedPopularity(slug: string): number {
  return seededUnit(`pop:${slug}`) ** 2.2;
}

/**
 * Lượt đọc theo ngày từ ngày đăng (tối đa `days` ngày gần nhất) tới `today`: đỉnh lúc mới đăng, giảm dần, cộng nhiễu.
 * `dayKeys` là các ngày YYYY-MM-DD theo thứ tự tăng dần.
 */
export function seedDailyViews(slug: string, publishedDay: string, dayKeys: readonly string[]): { day: string; views: number }[] {
  const popularity = seedPopularity(slug);
  const start = Date.parse(`${publishedDay}T00:00:00Z`);
  const rows: { day: string; views: number }[] = [];
  for (const day of dayKeys) {
    if (day < publishedDay) continue;
    const age = (Date.parse(`${day}T00:00:00Z`) - start) / DAY_MS;
    const decay = Math.exp(-age / 9) * 0.85 + 0.15;
    const noise = 0.6 + seededUnit(`view:${slug}:${day}`) * 0.8;
    const views = Math.round((4 + popularity * 140) * decay * noise);
    if (views > 0) rows.push({ day, views });
  }
  return rows;
}

/** Số người bình chọn (≤ `voters`) và số phiếu không đồng tình trong đó. */
export function seedVotePlan(slug: string, voters: number): { up: number; down: number } {
  const total = Math.min(voters, Math.round(seedPopularity(slug) * voters * 1.4));
  const down = Math.round(total * seededUnit(`down:${slug}`) * 0.25);
  return { up: total - down, down };
}

/** Số bình luận gốc cho một bài (0 với phần lớn bài, nhiều với vài bài). */
export function seedCommentCount(slug: string, max: number): number {
  const popularity = seedPopularity(slug);
  return popularity < 0.08 ? 0 : Math.min(max, Math.round(popularity * max * 1.2));
}
