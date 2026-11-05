import { describe, expect, it } from "vitest";

import type { Listing } from "@/features/landing-page/data/listings";
import { foldName, matchListings } from "@/features/map/map-place-match";

function listing(overrides: Partial<Listing>): Listing {
    return {
        id: "1",
        slug: "a",
        title: "Căn hộ 3 ngủ The Matrix One",
        location: "The Matrix One, phường Mễ Trì",
        district: "Nam Từ Liêm",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 1,
        areaM2: 1,
        beds: 0,
        living: 0,
        baths: 0,
        updatedAt: "2026-01-01",
        images: ["/a.jpg", "/b.jpg"],
        watchers: 12,
        ...overrides,
    } as Listing;
}

describe("matchListings", () => {
    const point = { lat: 21.0, lng: 105.8 };

    it("khớp theo tên đã bỏ dấu và cộng người quan tâm", () => {
        const source = [listing({}), listing({ id: "2", watchers: 5, images: ["/b.jpg", "/c.jpg"] }), listing({ id: "3", title: "Nhà khác", location: "Ngõ khác" })];
        const match = matchListings({ name: "the matrix one" }, point, source);
        expect(match.listings.map((item) => item.id)).toEqual(["1", "2"]);
        expect(match.watchers).toBe(17);
        expect(match.images).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
    });

    it("bỏ qua tên quá ngắn hoặc chỉ là số nhà", () => {
        expect(matchListings({ name: "12" }, point, [listing({ title: "12 Hàng Bạc" })]).listings).toHaveLength(0);
    });

    it("khớp theo tọa độ trong 60 m", () => {
        const near = listing({ title: "X", location: "Y", extra: { lat: 21.0003, lng: 105.8 } });
        expect(matchListings(null, point, [near]).listings).toHaveLength(1);
    });

    it("foldName", () => {
        expect(foldName("Đường Láng, Đống Đa")).toBe("duong lang dong da");
    });
});
