/** Hạn lưu trữ công bố trong Chính sách bảo mật (mục "Thời gian lưu trữ"). */
export const ACCOUNT_PURGE_AFTER_DAYS = 30;
export const AUTH_LOG_RETENTION_MONTHS = 12;

/** Địa chỉ giữ chỗ sau khi ẩn danh: duy nhất theo id và không gửi thư được (`.invalid`). */
export function anonymizedEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`;
}

export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - ACCOUNT_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
}
