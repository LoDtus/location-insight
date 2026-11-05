import { foldName } from "@/features/map/map-place-match";
import type { MapSuggestion } from "@/features/map/map.types";

/**
 * Enter khi chưa chọn gợi ý nào: nếu chuỗi gõ chỉ đúng một địa điểm cụ thể thì mở địa điểm đó, còn lại
 * (vd. "ngân hàng", "trường mầm non") coi là tìm theo loại hình và ghim mọi kết quả trong phạm vi.
 */
export function exactSuggestion(text: string, suggestions: readonly MapSuggestion[]): MapSuggestion | null {
    const wanted = foldName(text).replace(/\s+/g, " ").trim();
    if (wanted.length < 2 || suggestions.length === 0) return null;
    if (suggestions.length === 1) return suggestions[0];
    const exact = suggestions.filter((item) => foldName(item.name).replace(/\s+/g, " ").trim() === wanted);
    return exact.length === 1 ? exact[0] : null;
}
