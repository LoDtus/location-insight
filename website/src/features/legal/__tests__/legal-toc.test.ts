import { describe, expect, it } from "vitest";

import { extractToc, slugifyHeading } from "../legal-toc";

describe("legal-toc", () => {
    it("bỏ dấu tiếng Việt và đ khi tạo id", () => {
        expect(slugifyHeading("5. Chuyển dữ liệu ra nước ngoài")).toBe(
            "5-chuyen-du-lieu-ra-nuoc-ngoai",
        );
        expect(slugifyHeading("Điều khoản")).toBe("dieu-khoan");
    });

    it("lấy tiêu đề cấp 2 và giữ id duy nhất", () => {
        const toc = extractToc("# Tên\n\n## 1. Một\ntext\n### Con\n## Lặp\n## Lặp\n");

        expect(toc).toEqual([
            { id: "1-mot", text: "1. Một" },
            { id: "lap", text: "Lặp" },
            { id: "lap-2", text: "Lặp" },
        ]);
    });
});
