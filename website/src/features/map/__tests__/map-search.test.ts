import { describe, expect, it } from "vitest";

import { countFilters } from "@/features/map/components/map-filter-panel";
import { bestIndexes, buildCompareTable } from "@/features/map/compare/compare-table";
import { SEARCH_RADIUS, clampSearchRadius, formatRadius, zoomForRadius } from "@/features/map/map.geo";
import {
    SEARCH_HISTORY_KEY,
    SEARCH_HISTORY_MAX,
    clearSearchHistory,
    pushSearchHistory,
    readSearchHistory,
    removeSearchHistory,
} from "@/features/map/map-search-history";
import { exactSuggestion } from "@/features/map/map-search-intent";
import type { CompareItem, EvaluatedCriterion, MapSuggestion } from "@/features/map/map.types";

/** Đặc tả: workspace/features/013-map/README.md §4e–§4f, ui/ui-spec.md (Search Popover, bộ lọc, so sánh). */

function memoryStorage() {
    const data = new Map<string, string>();
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        removeItem: (key: string) => void data.delete(key),
    };
}

function suggestion(name: string): MapSuggestion {
    return { refId: `vm:POI:${name}`, name, address: "", addressOld: null, display: name, distanceKm: null };
}

describe("phạm vi tìm kiếm", () => {
    it("mặc định 10 km, kẹp trong 0,5–50 km", () => {
        expect(SEARCH_RADIUS.initial).toBe(10000);
        expect(clampSearchRadius(120)).toBe(500);
        expect(clampSearchRadius(90000)).toBe(50000);
        expect(clampSearchRadius(2549)).toBe(2500);
        expect(clampSearchRadius(Number.NaN)).toBe(10000);
        expect(formatRadius(2500)).toBe("2,5 km");
        expect(formatRadius(800)).toBe("800 m");
    });
});

describe("zoom sau khi tìm theo phạm vi", () => {
    it("10 km → 12,3; bán kính gấp đôi thì lùi một mức zoom; kẹp 4–18", () => {
        expect(zoomForRadius(10000)).toBe(12.3);
        expect(zoomForRadius(5000)).toBe(13.3);
        expect(zoomForRadius(20000)).toBe(11.3);
        expect(zoomForRadius(500)).toBeCloseTo(16.62, 2);
        expect(zoomForRadius(50000)).toBeCloseTo(9.98, 2);
        expect(zoomForRadius(1)).toBe(18);
    });
});

describe("Enter: địa điểm cụ thể hay tìm theo loại hình", () => {
    it("một gợi ý duy nhất hoặc đúng tên một gợi ý thì là địa điểm cụ thể", () => {
        expect(exactSuggestion("hồ gươm", [suggestion("Hồ Gươm")])?.name).toBe("Hồ Gươm");
        expect(exactSuggestion("Ho Guom", [suggestion("Hồ Gươm"), suggestion("Phố Hồ Gươm")])?.name).toBe("Hồ Gươm");
    });

    it("nhiều gợi ý không trùng tên (vd. “ngân hàng”) thì ghim tất cả", () => {
        expect(exactSuggestion("ngân hàng", [suggestion("Ngân hàng Vietcombank"), suggestion("Ngân hàng BIDV")])).toBeNull();
        expect(exactSuggestion("ngân hàng", [])).toBeNull();
    });
});

describe("lịch sử tìm kiếm (localStorage)", () => {
    it("mới nhất lên đầu, bỏ trùng, tối đa 8 mục, xóa được", () => {
        const storage = memoryStorage();
        for (let index = 0; index < 10; index += 1) pushSearchHistory({ type: "query", text: `quán ${index}`, at: 0 }, storage);
        pushSearchHistory({ type: "query", text: "QUÁN 5", at: 0 }, storage);
        const list = readSearchHistory(storage);
        expect(list).toHaveLength(SEARCH_HISTORY_MAX);
        expect(list[0].text).toBe("QUÁN 5");
        expect(list.filter((entry) => entry.text.toLowerCase() === "quán 5")).toHaveLength(1);
        expect(removeSearchHistory(list[0], storage)).toHaveLength(SEARCH_HISTORY_MAX - 1);
        clearSearchHistory(storage);
        expect(readSearchHistory(storage)).toEqual([]);
    });

    it("bỏ qua dữ liệu hỏng hoặc tọa độ ngoài Việt Nam", () => {
        const storage = memoryStorage();
        storage.setItem(
            SEARCH_HISTORY_KEY,
            JSON.stringify([{ type: "place", text: "Paris", lat: 48.85, lng: 2.35 }, { type: "query", text: "x" }, "rác", { type: "query", text: "chợ" }]),
        );
        expect(readSearchHistory(storage).map((entry) => entry.text)).toEqual(["chợ"]);
        storage.setItem(SEARCH_HISTORY_KEY, "{không phải json");
        expect(readSearchHistory(storage)).toEqual([]);
    });
});

describe("bộ lọc", () => {
    it("badge đếm từng lựa chọn đã áp dụng, không tính bán kính", () => {
        expect(countFilters({})).toBe(0);
        expect(countFilters({ scope: "POI,ADDRESS", cats: "1002-1", radius: 2000 })).toBe(3);
    });
});

function criterion(id: EvaluatedCriterion["id"], score: number, skipped = false): EvaluatedCriterion {
    return { id, label: id, group: "walk", groupLabel: "Đi bộ", verdict: "", detail: "", source: "", score, autoScore: score, manual: false, skipped, weight: 1, defaultWeight: 1 };
}

function compareItem(id: string, overall: number | null, criteria: EvaluatedCriterion[]): CompareItem {
    return {
        id,
        placeId: id,
        lat: 21,
        lng: 105.8,
        name: id,
        address: "",
        kind: null,
        label: null,
        note: "",
        compared: true,
        createdAt: "",
        evaluation:
            overall === null
                ? null
                : ({
                      overall,
                      strengths: { points: 0, items: criteria },
                      weaknesses: { points: 0, items: [] },
                      skipped: [],
                  } as unknown as CompareItem["evaluation"]),
    };
}

describe("bảng so sánh", () => {
    it("đánh dấu cột cao nhất; cần ít nhất 2 cột có điểm; hòa toàn bộ thì không đánh dấu", () => {
        expect(bestIndexes([7, null, 9, 9])).toEqual([2, 3]);
        expect(bestIndexes([7, null])).toEqual([]);
        expect(bestIndexes([5, 5])).toEqual([]);
    });

    it("hàng theo thứ tự 19 tiêu chí cố định; ô đã bỏ qua không được tính là tốt nhất; cột chưa đánh giá là null", () => {
        const table = buildCompareTable([
            compareItem("a", 7, [criterion("quan-an", 9, true), criterion("cho", 6)]),
            compareItem("b", 8, [criterion("cho", 4), criterion("quan-an", 5)]),
            compareItem("c", null, []),
        ]);
        const rows = table.groups[0].rows;
        expect(rows.map((row) => row.id)).toEqual(["cho", "quan-an"]);
        expect(rows[0].best).toEqual([0]);
        expect(rows[1].best).toEqual([]);
        expect(rows[0].cells[2]).toBeNull();
        expect(table.bestOverall).toEqual([1]);
    });
});
