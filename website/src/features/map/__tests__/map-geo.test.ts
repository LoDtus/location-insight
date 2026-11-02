import { describe, expect, it } from "vitest";

import {
    formatDistance,
    formatDuration,
    metersPerPixel,
    niceScale,
    routeToFeatures,
} from "@/features/map/map.geo";
import type { MapRoute } from "@/features/map/map.types";

describe("niceScale", () => {
    it("zoom 15 ở Hà Nội ≈ 2,2 m/px (tile 512 px), mốc không vượt 96 px", () => {
        const perPx = metersPerPixel(15, 21.03);
        expect(perPx).toBeGreaterThan(2.1);
        expect(perPx).toBeLessThan(2.4);
        const scale = niceScale(15, 21.03);
        expect(scale.px).toBeLessThanOrEqual(96);
        expect(scale.meters).toBe(200);
        expect(scale.label).toBe("200 m");
    });
    it("zoom thấp dùng km", () => {
        expect(niceScale(8, 21).label).toMatch(/km$/);
    });
});

describe("định dạng", () => {
    it("khoảng cách", () => {
        expect(formatDistance(4679.8)).toBe("4,7 km");
        expect(formatDistance(250)).toBe("250 m");
        expect(formatDistance(3)).toBe("< 10 m");
    });
    it("thời gian", () => {
        expect(formatDuration(30)).toBe("1 phút");
        expect(formatDuration(991)).toBe("17 phút");
        expect(formatDuration(3600)).toBe("1 giờ");
        expect(formatDuration(4980)).toBe("1 giờ 23 phút");
    });
});

describe("routeToFeatures", () => {
    const base: MapRoute = {
        distanceM: 1,
        durationS: 1,
        bbox: [0, 0, 1, 1],
        geometry: [
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
        ],
        steps: [],
        congestion: null,
    };
    it("không có dữ liệu tắc → một đoạn unknown", () => {
        const fc = routeToFeatures(base);
        expect(fc.features).toHaveLength(1);
        expect(fc.features[0].properties.level).toBe("unknown");
    });
    it("gộp đoạn liên tiếp cùng mức, đầu nối đuôi", () => {
        const fc = routeToFeatures({ ...base, congestion: ["heavy", "heavy", "low"] });
        expect(fc.features.map((f) => f.properties.level)).toEqual(["heavy", "low"]);
        expect(fc.features[0].geometry.coordinates).toHaveLength(3);
        expect(fc.features[1].geometry.coordinates).toEqual([
            [2, 0],
            [3, 0],
        ]);
    });
    it("độ dài congestion sai → rơi về một đoạn", () => {
        expect(routeToFeatures({ ...base, congestion: ["low"] }).features).toHaveLength(1);
    });
});
