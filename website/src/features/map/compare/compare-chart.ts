import type { CompareTable } from "@/features/map/compare/compare-table";
import type { CompareItem, CriterionGroup, EvaluatedCriterion } from "@/features/map/map.types";

/**
 * Dữ liệu cho biểu đồ so sánh (ECharts). Tách khỏi component để kiểm thử được.
 * - Màu theo địa điểm, không theo vị trí cột: kéo/xếp lại cột không đổi màu (gán theo thứ tự thêm vào).
 * - Điểm nhóm = trung bình có trọng số của các tiêu chí được tính vào điểm tổng (bỏ tiêu chí đã bỏ qua, chưa có dữ
 *   liệu và tiêu chí AI chưa làm), cùng cách tính điểm tổng.
 */

/** Bảng màu phân loại cố định (thứ tự đã kiểm tra phân biệt được với người mù màu); tối đa 6 địa điểm. */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"] as const;
/** Ký hiệu điểm khác nhau cho từng địa điểm: không phân biệt chỉ bằng màu. */
export const SERIES_SYMBOLS = ["circle", "rect", "triangle", "diamond", "roundRect", "pin"] as const;

export interface ChartPlace {
    id: string;
    name: string;
    color: string;
    symbol: string;
    overall: number;
    /** Điểm theo nhóm (null khi cả nhóm bị bỏ qua). */
    groups: Record<CriterionGroup, number | null>;
}

/** Gán màu theo thứ tự thêm (createdAt, rồi id) để màu đi theo địa điểm. */
export function colorSlots(items: readonly CompareItem[]): Map<string, number> {
    const stable = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return new Map(stable.map((item, index) => [item.id, index % SERIES_COLORS.length]));
}

/** Trung bình có trọng số các tiêu chí được tính của nhóm; trọng số 0 hết thì lấy trung bình thường. */
export function groupScore(table: CompareTable, column: number, group: CriterionGroup): number | null {
    const rows = table.groups.find((entry) => entry.group === group)?.rows ?? [];
    const cells = rows.map((row) => row.cells[column]).filter((cell): cell is EvaluatedCriterion => cell !== null && cell !== undefined && cell.counted);
    if (cells.length === 0) return null;
    const weight = cells.reduce((sum, cell) => sum + cell.weight, 0);
    const value = weight > 0 ? cells.reduce((sum, cell) => sum + cell.score * cell.weight, 0) / weight : cells.reduce((sum, cell) => sum + cell.score, 0) / cells.length;
    return Math.round(value * 10) / 10;
}

/** Các địa điểm đã có đánh giá, theo thứ tự cột hiện tại. */
export function chartPlaces(items: readonly CompareItem[], table: CompareTable, titleOf: (item: CompareItem) => string): ChartPlace[] {
    const slots = colorSlots(items);
    const seen = new Map<string, number>();
    // Tên trùng làm ECharts gộp chú giải: thêm số thứ tự cho tên lặp.
    const uniqueName = (name: string): string => {
        const count = (seen.get(name) ?? 0) + 1;
        seen.set(name, count);
        return count > 1 ? `${name} (${count})` : name;
    };
    return items.flatMap((item, column) => {
        const overall = item.evaluation?.overall;
        if (overall === null || overall === undefined) return [];
        const slot = slots.get(item.id) ?? 0;
        return [
            {
                id: item.id,
                name: uniqueName(titleOf(item)),
                color: SERIES_COLORS[slot],
                symbol: SERIES_SYMBOLS[slot],
                overall,
                groups: {
                    walk: groupScore(table, column, "walk"),
                    move: groupScore(table, column, "move"),
                    health: groupScore(table, column, "health"),
                    env: groupScore(table, column, "env"),
                    // Tiêu chí AI chưa thực hiện: chỉ có số minh họa, không đưa lên biểu đồ.
                    ai: null,
                },
            },
        ];
    });
}
