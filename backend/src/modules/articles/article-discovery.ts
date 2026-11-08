/**
 * Quy tắc xếp hạng cho trang /bai-viet (thuần, kiểm thử được). Tham khảo cách các trang tin lớn chia mục:
 * - Nổi bật = đọc nhiều nhất trong cửa sổ gần (7 ngày, thiếu thì 30 ngày, rồi toàn thời gian).
 * - Được quan tâm = nhiều bình luận và phiếu trong 30 ngày; bình luận nặng hơn phiếu vì tốn công hơn.
 * - Đề xuất = chất lượng (tỷ lệ thích có hiệu chỉnh) × độ phổ biến, giảm dần theo tuổi bài; với người đã đăng nhập
 *   cộng thêm mức hợp chủ đề từ lịch sử phiếu/bình luận và bỏ bài họ đã tương tác.
 */

export type RankInput = {
  id: string;
  topic: string;
  publishedAt: Date;
  views: number;
  upvotes: number;
  downvotes: number;
  comments: number;
};

/** Tỷ lệ thích có hiệu chỉnh (cận dưới Wilson 95%): ít phiếu thì không nhảy lên đầu chỉ vì 1/1 phiếu thích. */
export function wilsonLower(up: number, down: number): number {
  const n = up + down;
  if (n === 0) return 0;
  const z = 1.96;
  const p = up / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
}

export function engagementScore(item: Pick<RankInput, 'comments' | 'upvotes' | 'downvotes'>): number {
  return item.comments * 3 + item.upvotes + item.downvotes;
}

/** Điểm đề xuất; `affinity` (0..1) theo chủ đề người đọc hay quan tâm, 0 với khách. */
export function recommendScore(item: RankInput, now: Date, affinity = 0): number {
  const ageDays = Math.max(0, (now.getTime() - item.publishedAt.getTime()) / 86_400_000);
  const quality = 0.5 + wilsonLower(item.upvotes, item.downvotes);
  const reach = Math.log10(item.views + item.comments * 5 + 10);
  const freshness = Math.pow(0.5, ageDays / 45);
  return quality * reach * (0.35 + freshness) * (1 + affinity * 1.5);
}

/** Trọng số chủ đề từ tương tác của người dùng (phiếu thích +2, bình luận +3, không thích −1), chuẩn hóa về 0..1. */
export function topicAffinity(signals: { topic: string; weight: number }[]): Map<string, number> {
  const raw = new Map<string, number>();
  for (const signal of signals) raw.set(signal.topic, (raw.get(signal.topic) ?? 0) + signal.weight);
  const max = Math.max(0, ...raw.values());
  const out = new Map<string, number>();
  if (max <= 0) return out;
  for (const [topic, value] of raw) out.set(topic, Math.max(0, value) / max);
  return out;
}

/** Người đọc là bot/xem trước liên kết: không tính lượt đọc. */
export function isBotAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python-requests/i.test(userAgent);
}

/** Các mục của /bai-viet có phân trang (Đề xuất là băng trượt, khối chủ đề dẫn sang trang lọc nên không phân trang). */
export const HOME_SECTIONS = ['latest', 'popular', 'engaged', 'media'] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

/** Số bài mỗi trang của từng mục, và số bài tối đa được xếp hạng cho mục đó. */
export const HOME_PAGING: Record<HomeSection, { pageSize: number; cap: number }> = {
  latest: { pageSize: 8, cap: 80 },
  popular: { pageSize: 5, cap: 20 },
  engaged: { pageSize: 5, cap: 30 },
  media: { pageSize: 5, cap: 30 },
};
