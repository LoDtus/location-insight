import { describe, expect, it } from "vitest";

import type { RichTextDoc } from "@/shared/components/editor/rich-text.types";
import { EMPTY_RICH_TEXT, isRichTextDoc, isRichTextEmpty, normalizeLinkUrl, richTextToPlain } from "@/shared/components/editor/rich-text.utils";

describe("normalizeLinkUrl", () => {
    it("thêm https cho địa chỉ trần", () => {
        expect(normalizeLinkUrl("example.com/trang")).toBe("https://example.com/trang");
    });

    it("giữ http, https, mailto, tel", () => {
        expect(normalizeLinkUrl("http://example.com")).toBe("http://example.com/");
        expect(normalizeLinkUrl("mailto:a@example.com")).toBe("mailto:a@example.com");
        expect(normalizeLinkUrl("tel:0912345678")).toBe("tel:0912345678");
    });

    it("chặn javascript:, data: và giao thức lạ", () => {
        expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
        expect(normalizeLinkUrl("JaVaScRiPt:alert(1)")).toBeNull();
        expect(normalizeLinkUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
        expect(normalizeLinkUrl("ftp://example.com")).toBeNull();
    });

    it("chặn chuỗi rỗng, có khoảng trắng hoặc không có tên miền", () => {
        expect(normalizeLinkUrl("")).toBeNull();
        expect(normalizeLinkUrl("   ")).toBeNull();
        expect(normalizeLinkUrl("hai tu")).toBeNull();
        expect(normalizeLinkUrl("localhost")).toBeNull();
    });
});

describe("richTextToPlain và isRichTextEmpty", () => {
    const doc: RichTextDoc = {
        type: "doc",
        content: [
            { type: "paragraph", content: [{ type: "text", text: "Nhà " }, { type: "text", text: "đẹp", marks: [{ type: "bold" }] }] },
            { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Gần hồ" }] }] }] },
        ],
    };

    it("gom chữ theo khối và bỏ định dạng", () => {
        expect(richTextToPlain(doc)).toBe("Nhà đẹp\nGần hồ");
    });

    it("tài liệu rỗng hoặc chỉ có đoạn trống là rỗng", () => {
        expect(isRichTextEmpty(EMPTY_RICH_TEXT)).toBe(true);
        expect(isRichTextEmpty(null)).toBe(true);
        expect(isRichTextEmpty(doc)).toBe(false);
    });
});

describe("isRichTextDoc", () => {
    it("chỉ nhận đối tượng có type doc", () => {
        expect(isRichTextDoc(EMPTY_RICH_TEXT)).toBe(true);
        expect(isRichTextDoc({ type: "paragraph" })).toBe(false);
        expect(isRichTextDoc({ type: "doc", content: "x" })).toBe(false);
        expect(isRichTextDoc(null)).toBe(false);
        expect(isRichTextDoc("doc")).toBe(false);
    });
});
