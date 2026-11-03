/** Alias không hậu tố mà ứng dụng dùng để đọc/ghi (naming.md: không bao giờ trỏ thẳng index có phiên bản). */
export function aliasName(prefix: string, profileName: string): string {
  return `${prefix}${profileName}`;
}

/**
 * Hai tên index luân phiên cho cùng một phiên bản: `-vN` và `-vN-b`. Dựng lại không đổi phiên bản
 * ghi vào tên chưa được alias trỏ tới; index trước đó được giữ lại tới lần dựng lại kế tiếp để quay lui.
 */
export function indexCandidates(
  prefix: string,
  profileName: string,
  version: number,
): [string, string] {
  const base = `${aliasName(prefix, profileName)}-v${version}`;
  return [base, `${base}-b`];
}

/** Lấy số phiên bản từ tên index (`x-v3`, `x-v3-b` → 3); null nếu không đúng dạng. */
export function parseIndexVersion(indexName: string): number | null {
  const match = /-v(\d+)(?:-b)?$/.exec(indexName);
  return match?.[1] ? Number(match[1]) : null;
}
