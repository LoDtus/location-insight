import { describe, expect, it } from "vitest";

import { chartPlaces, colorSlots, groupScore, SERIES_COLORS } from "@/features/map/compare/compare-chart";
import type { CompareTable } from "@/features/map/compare/compare-table";
import type { CompareItem, EvaluatedCriterion } from "@/features/map/map.types";

function place(id: string, createdAt: string, overall: number | null, name = id): CompareItem {
    return { id, createdAt, name, label: null, evaluation: overall === null ? null : { overall } } as unknown as CompareItem;
}

function cell(score: number, weight: number, skipped = false): EvaluatedCriterion {
    return { score, weight, skipped } as unknown as EvaluatedCriterion;
}

const table = {
    bestOverall: [],
    groups: [
        {
            group: "walk",
            label: "Đi bộ",
            rows: [
                { cells: [cell(8, 3), cell(4, 1, true), null] },
                { cells: [cell(4, 1), cell(6, 0), null] },
            ],
        },
    ],
} as unknown as CompareTable;

describe("biểu đồ so sánh", () => {
    it("điểm nhóm là trung bình có trọng số, bỏ ô đã bỏ qua; trọng số 0 hết thì trung bình thường; không có ô thì null", () => {
        expect(groupScore(table, 0, "walk")).toBe(7);
        expect(groupScore(table, 1, "walk")).toBe(6);
        expect(groupScore(table, 2, "walk")).toBeNull();
        expect(groupScore(table, 0, "env")).toBeNull();
    });

    it("màu đi theo địa điểm (thứ tự thêm), không đổi khi xếp lại cột", () => {
        const a = place("a", "2026-01-01", 7);
        const b = place("b", "2026-02-01", 6);
        expect(colorSlots([a, b])).toEqual(colorSlots([b, a]));
        expect(colorSlots([b, a]).get("a")).toBe(0);
    });

    it("chỉ gồm địa điểm đã đánh giá, theo thứ tự cột; tên trùng được đánh số", () => {
        const items = [place("b", "2026-02-01", 6, "Nhà"), place("x", "2026-03-01", null), place("a", "2026-01-01", 7, "Nhà")];
        const out = chartPlaces(items, table, (item) => item.name);
        expect(out.map((p) => [p.id, p.name, p.color])).toEqual([
            ["b", "Nhà", SERIES_COLORS[1]],
            ["a", "Nhà (2)", SERIES_COLORS[0]],
        ]);
    });
});
