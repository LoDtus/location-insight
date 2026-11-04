import { describe, expect, it } from "vitest";

import { circleBounds, circleToPolygon, placeLink } from "@/features/map/map.geo";

function metersBetween(a: [number, number], b: { lat: number; lng: number }): number {
    const rad = (deg: number): number => (deg * Math.PI) / 180;
    const dLat = rad(a[1] - b.lat);
    const dLng = rad(a[0] - b.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(b.lat)) * Math.cos(rad(a[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

describe("circleToPolygon", () => {
    const center = { lat: 21.0285, lng: 105.8542 };

    it("mọi đỉnh cách tâm đúng bán kính và vòng khép kín", () => {
        const ring = circleToPolygon(center, 500).features[0].geometry.coordinates[0];
        expect(ring[0]).toEqual(ring[ring.length - 1]);
        for (const vertex of ring) expect(metersBetween(vertex, center)).toBeCloseTo(500, 0);
    });

    it("hộp bao chứa tâm và rộng xấp xỉ 2 lần bán kính", () => {
        const [minLng, minLat, maxLng, maxLat] = circleBounds(center, 1000);
        expect(minLng).toBeLessThan(center.lng);
        expect(maxLng).toBeGreaterThan(center.lng);
        expect(minLat).toBeLessThan(center.lat);
        expect(maxLat).toBeGreaterThan(center.lat);
        expect(metersBetween([minLng, center.lat], { lat: center.lat, lng: maxLng })).toBeCloseTo(2000, -1);
    });
});

describe("placeLink", () => {
    it("mang đủ tâm, zoom mặc định và ghim với 6 chữ số thập phân", () => {
        expect(placeLink("https://x.vn", "/app/map", { lat: 21.028512345, lng: 105.854212345 })).toBe(
            "https://x.vn/app/map?c=21.028512,105.854212&z=16&pin=21.028512,105.854212",
        );
    });
});
