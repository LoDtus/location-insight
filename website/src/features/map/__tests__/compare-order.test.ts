import { describe, expect, it } from "vitest";

import { applyOrder, moveItem, sortByOverall } from "@/features/map/compare/compare-order";
import type { CompareItem } from "@/features/map/map.types";

function item(id: string, overall: number | null | undefined): CompareItem {
    return { id, evaluation: overall === undefined ? null : { overall } } as unknown as CompareItem;
}

describe("thứ tự bảng so sánh", () => {
    it("sắp theo điểm tổng hai chiều; chưa có điểm luôn cuối; bằng điểm giữ thứ tự cũ", () => {
        const list = [item("a", 6), item("b", undefined), item("c", 8), item("d", 6), item("e", null)];
        expect(sortByOverall(list, "desc").map((x) => x.id)).toEqual(["c", "a", "d", "b", "e"]);
        expect(sortByOverall(list, "asc").map((x) => x.id)).toEqual(["a", "d", "c", "b", "e"]);
    });

    it("đổi chỗ phần tử không làm đổi mảng gốc", () => {
        const list = ["a", "b", "c", "d"];
        expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
        expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
        expect(list).toEqual(["a", "b", "c", "d"]);
    });

    it("áp thứ tự đã lưu; id mới nằm sau theo thứ tự gốc; id đã lưu nhưng không còn thì bỏ qua", () => {
        const rows = ["x", "y", "z", "w"];
        expect(applyOrder(rows, (id) => id, ["z", "gone", "x"])).toEqual(["z", "x", "y", "w"]);
        expect(applyOrder(rows, (id) => id, undefined)).toEqual(rows);
    });
});
