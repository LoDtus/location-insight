import { describe, expect, it } from "vitest";

import { activeSection, FRONT_SECTIONS, isFresh, isFrontSection, pageWindow, relativeTime, urlWithSection } from "@/features/articles/front-sections";

describe("front-sections", () => {
    it("mỗi mục có id riêng và nhận diện được", () => {
        const ids = FRONT_SECTIONS.map((section) => section.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(isFrontSection("moi-nhat")).toBe(true);
        expect(isFrontSection("khong-co")).toBe(false);
    });

    it("mục đang đọc là mục cuối đã vượt vạch đọc", () => {
        const ids = ["a", "b", "c"] as const;
        expect(activeSection(ids, [300, 900, 1500], 200)).toBeNull();
        expect(activeSection(ids, [-400, 150, 800], 200)).toBe("b");
        expect(activeSection(ids, [-2000, -1200, -10], 200)).toBe("c");
    });

    it("đổi hash nhưng giữ đường dẫn và query", () => {
        expect(urlWithSection("/bai-viet", "", "noi-bat")).toBe("/bai-viet#noi-bat");
        expect(urlWithSection("/bai-viet", "?a=1", null)).toBe("/bai-viet?a=1");
    });

    it("thanh phân trang lược trang ở giữa nhưng không lược đúng một trang", () => {
        expect(pageWindow(1, 1)).toEqual([1]);
        expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
        expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
        expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, "gap", 10]);
        expect(pageWindow(10, 10)).toEqual([1, "gap", 9, 10]);
    });

    it("thời gian tương đối trong 7 ngày, quá thì null", () => {
        const now = Date.parse("2026-11-08T12:00:00Z");
        expect(relativeTime("2026-11-08T10:00:00Z", now, "vi-VN")).toContain("2");
        expect(relativeTime("2026-10-01T10:00:00Z", now, "vi-VN")).toBeNull();
        expect(isFresh("2026-11-08T10:00:00Z", now)).toBe(true);
        expect(isFresh("2026-11-07T10:00:00Z", now)).toBe(false);
        expect(isFresh("2026-11-09T10:00:00Z", now)).toBe(false);
    });
});
