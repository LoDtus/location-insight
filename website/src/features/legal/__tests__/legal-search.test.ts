import { describe, expect, it } from "vitest";

import type { LegalSearchItem } from "@/features/legal/legal-search";
import { filterLegalDocuments, scoreLegalDocument } from "@/features/legal/legal-search";

const ITEMS: LegalSearchItem[] = [
    {
        slug: "dieu-khoan",
        title: "Điều khoản sử dụng",
        description: "Quyền và nghĩa vụ khi dùng Địa Thế.",
        indexable: true,
        order: 0,
    },
    {
        slug: "chinh-sach-bao-mat",
        title: "Chính sách quyền riêng tư",
        description: "Dữ liệu cá nhân Địa Thế thu thập.",
        indexable: true,
        order: 1,
    },
    {
        slug: "chinh-sach-cookie",
        title: "Chính sách cookie",
        description: "Cookie Địa Thế dùng.",
        indexable: true,
        order: 2,
    },
    {
        slug: "thue",
        title: "Nghĩa vụ thuế",
        description: "Thuế của cá nhân kinh doanh.",
        indexable: false,
        order: 8,
    },
];

describe("legal search", () => {
    it("ranks a title phrase above a description mention", () => {
        const title = scoreLegalDocument(ITEMS[1], "quyen rieng tu");
        const description = scoreLegalDocument(ITEMS[0], "dia the");

        expect(title).toBeGreaterThan(description);
        expect(description).toBeGreaterThan(0);
    });

    it("matches a one-character typo in a title word", () => {
        expect(scoreLegalDocument(ITEMS[2], "cooki")).toBeGreaterThan(0);
    });

    it("drops a document when one word does not match", () => {
        expect(scoreLegalDocument(ITEMS[0], "dieu khoan thue")).toBe(0);
    });

    it("orders a search by weight and a name sort alphabetically", () => {
        const byWeight = filterLegalDocuments(ITEMS, "chinh sach", "relevance", "vi");
        const byName = filterLegalDocuments(ITEMS, "", "title-asc", "vi");

        expect(byWeight.map((item) => item.slug)).toEqual([
            "chinh-sach-bao-mat",
            "chinh-sach-cookie",
        ]);
        expect(byName[0]?.title.localeCompare(byName[1]?.title ?? "", "vi")).toBeLessThanOrEqual(
            0,
        );
    });
});
