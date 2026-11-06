import { describe, expect, it } from "vitest";

import { docToMarkup, markupToDoc } from "@/features/discussions/post-editor-doc";
import type { RichTextNode } from "@/shared/components/editor/rich-text.types";

/** Đặc tả: workspace/features/008-discussions/README.md FR-14, FR-15 (soạn thấy định dạng, lưu markup nhẹ). */
const text = (value: string, ...marks: Array<string | { type: string; attrs: Record<string, unknown> }>): RichTextNode => ({
    type: "text",
    text: value,
    ...(marks.length ? { marks: marks.map((mark) => (typeof mark === "string" ? { type: mark } : mark)) } : {}),
});
const doc = (...content: RichTextNode[]) => ({ type: "doc" as const, content });
const p = (...content: RichTextNode[]): RichTextNode => ({ type: "paragraph", content });

describe("docToMarkup", () => {
    it("định dạng cơ bản, lồng nhau và dấu kề nhau", () => {
        expect(docToMarkup(doc(p(text("Xin "), text("chào", "bold"), text(" cả "), text("nhà", "italic"))))).toBe("Xin **chào** cả *nhà*");
        expect(docToMarkup(doc(p(text("a", "bold"), text("b", "bold", "italic"), text("c", "bold"))))).toBe("**a*b*c**");
        expect(docToMarkup(doc(p(text("gạch", "underline"), text(" "), text("ngang", "strike"))))).toBe("++gạch++ ~~ngang~~");
    });

    it("khoảng trắng nằm ngoài dấu định dạng", () => {
        expect(docToMarkup(doc(p(text("đậm ", "bold"), text("thường"))))).toBe("**đậm** thường");
        expect(docToMarkup(doc(p(text("x"), text(" y", "bold"))))).toBe("x **y**");
    });

    it("liên kết, xuống dòng, đoạn trống và trích dẫn", () => {
        const link = { type: "link", attrs: { href: "/map?c=1" } };
        expect(
            docToMarkup(
                doc(
                    p(text("📍 "), text("Hồ Gươm", link)),
                    { type: "paragraph" },
                    p(text("dòng 1"), { type: "hardBreak" }, text("dòng 2")),
                    { type: "blockquote", content: [p(text("trích "), text("đậm", "bold")), p(text("tiếp"))] },
                ),
            ),
        ).toBe("📍 [Hồ Gươm](/map?c=1)\n\ndòng 1\ndòng 2\n> trích **đậm**\n> tiếp");
    });
});

describe("markupToDoc (khôi phục bản nháp) đi một vòng không mất định dạng", () => {
    it.each([
        "Xin **chào** cả *nhà*",
        "++gạch chân++ và ~~gạch ngang~~",
        "📍 [Hồ Gươm](/map?c=21.02,105.85&pin=21.02,105.85) xem thêm",
        "mở\n> trích **đậm**\n> tiếp\nkết",
        "dòng 1\n\ndòng 3",
    ])("%s", (markup) => {
        expect(docToMarkup(markupToDoc(markup))).toBe(markup);
    });
});
