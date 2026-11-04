import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RichTextMarkdownContent from "@/shared/components/editor/rich-text-markdown-content";
import { markdownToDoc, withHeadingIds } from "@/shared/components/editor/rich-text-markdown";
import { normalizeLinkUrl } from "@/shared/components/editor/rich-text.utils";

const SOURCE = [
    "Đoạn mở đầu có **đậm** và [nhà đất](/nha-dat).",
    "",
    "## Cách đọc giá",
    "",
    "- Mục một",
    "- Mục hai",
    "",
    "### Cách đọc giá",
    "",
    "1. Bước một",
    "2. Bước hai",
].join("\n");

describe("markdown ↔ tài liệu", () => {
    it("tạo mục lục với id ổn định và không trùng", () => {
        const { headings } = withHeadingIds(markdownToDoc(SOURCE));
        expect(headings).toEqual([
            { id: "cach-doc-gia", level: 2, text: "Cách đọc giá" },
            { id: "cach-doc-gia-2", level: 3, text: "Cách đọc giá" },
        ]);
    });

    it("dựng HTML có id tiêu đề, liên kết nội bộ và không có HTML thô", () => {
        const html = renderToStaticMarkup(<RichTextMarkdownContent source={`${SOURCE}\n\n<script>alert(1)</script>`} />);
        expect(html).toContain('id="cach-doc-gia"');
        expect(html).toContain('href="/nha-dat"');
        expect(html).toContain("<strong>đậm</strong>");
        expect(html).not.toContain("<script");
    });
});

describe("normalizeLinkUrl", () => {
    it("nhận đường dẫn nội bộ nhưng chặn javascript: và coi // là tên miền ngoài", () => {
        expect(normalizeLinkUrl("/bai-viet/abc")).toBe("/bai-viet/abc");
        expect(normalizeLinkUrl("//evil.com")).toBe("https://evil.com/");
        expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
    });
});
