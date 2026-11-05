import { describe, expect, it } from "vitest";

import { LISTINGS } from "@/features/landing-page/data/listings";
import { DISTRICT_CENTERS } from "@/features/landing-page/data/district-centers";
import { OTHER_AMENITIES, POI_CATEGORIES, listingPins, shortPrice, tilesFor } from "@/features/map/map-overlays";
import { buildMapUrl, parseMapUrl } from "@/features/map/map-url";

/** Đặc tả: workspace/features/013-map/README.md §4g, ui/ui-spec.md (Lớp bản đồ). */

describe("lớp hiển thị", () => {
    it("“Tiện ích khác” là mọi nhóm trừ trường học và ngân hàng", () => {
        expect(OTHER_AMENITIES).not.toContain("school");
        expect(OTHER_AMENITIES).not.toContain("bank");
        expect(OTHER_AMENITIES).toHaveLength(POI_CATEGORIES.length - 2);
    });

    it("tham số URL `layers` giữ cả giao thông và lớp hiển thị, thứ tự ổn định", () => {
        const { state, errors } = parseMapUrl(new URLSearchParams("layers=bank,traffic,listing"));
        expect(errors).toEqual([]);
        expect(state.traffic).toBe(true);
        expect(state.overlays).toEqual(["listing", "bank"]);
        expect(buildMapUrl(state)).toBe("layers=traffic%2Clisting%2Cbank".replace(/%2C/g, ","));
        expect(parseMapUrl(new URLSearchParams("layers=nhà-hàng")).errors.map((error) => error.param)).toEqual(["layers"]);
    });

    it("ô zoom 13 phủ khung nhìn; khung nhìn quá rộng thì không tải", () => {
        const tiles = tilesFor([105.84, 21.02, 105.86, 21.04]);
        expect(tiles.length).toBeGreaterThanOrEqual(1);
        expect(tiles.length).toBeLessThanOrEqual(4);
        expect(tilesFor([104, 20, 107, 22])).toEqual([]);
    });
});

describe("tin rao trên bản đồ", () => {
    it("tin không có tọa độ đặt gần tâm quận (≤ 1,5 km), cố định giữa các lần tính", () => {
        const pins = listingPins();
        const again = listingPins();
        expect(pins.length).toBeGreaterThan(0);
        for (const [index, pin] of pins.entries()) {
            expect(again[index].point).toEqual(pin.point);
            if (!pin.approximate) continue;
            const center = DISTRICT_CENTERS[pin.listing.district];
            const dLat = (pin.point.lat - center.lat) * 111_320;
            const dLng = (pin.point.lng - center.lng) * 111_320 * Math.cos((center.lat * Math.PI) / 180);
            expect(Math.hypot(dLat, dLng)).toBeLessThanOrEqual(1501);
        }
        expect(pins.length).toBeLessThanOrEqual(LISTINGS.length);
    });

    it("nhãn giá ngắn", () => {
        expect(shortPrice({ purpose: "ban", priceVnd: 3_250_000_000 })).toBe("3,3 tỷ");
        expect(shortPrice({ purpose: "ban", priceVnd: 850_000_000 })).toBe("850 tr");
        expect(shortPrice({ purpose: "thue", priceVnd: 12_000_000 })).toBe("12 tr/th");
    });
});
