import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PostBody, internalHref, stripMarkup, toggleQuote, toggleWrap } from "@/features/discussions/post-markup";

/** Đặc tả: workspace/features/008-discussions/README.md FR-14 (markup nhẹ, không HTML). */
function html(body: string, root = "/app"): string {
    return renderToStaticMarkup(<PostBody body={body} root={root} />);
}

describe("PostBody", () => {
    it("đậm, nghiêng, gạch chân, gạch ngang, lồng nhau", () => {
        const out = html("**đậm** *nghiêng* ++gạch chân++ ~~gạch~~ **có *lồng* nhé**");
        expect(out).toContain("<strong");
        expect(out).toContain("<em>nghiêng</em>");
        expect(out).toContain("<u");
        expect(out).toContain("<s>gạch</s>");
        expect(out).toMatch(/<strong[^>]*>có <em>lồng<\/em> nhé<\/strong>/);
    });

    it("dòng “> ” liền nhau thành một khối trích dẫn", () => {
        const out = html("mở đầu\n> dòng 1\n> dòng 2\nkết");
        expect(out.match(/<blockquote/g)).toHaveLength(1);
        expect(out).toContain("dòng 1\ndòng 2");
    });

    it("liên kết ngoài mở tab mới có rel an toàn; liên kết /map gắn khu vực", () => {
        const out = html("[Hồ Gươm](/map?c=21.02,105.85&pin=21.02,105.85) và https://example.com/a", "/admin");
        expect(out).toContain('href="/admin/map?c=21.02,105.85&amp;pin=21.02,105.85"');
        expect(out).toContain('rel="noopener noreferrer nofollow ugc"');
        expect(out).toContain(">example.com/a<");
    });

    it("không nhận javascript: hay giao thức lạ; HTML hiện như chữ", () => {
        const out = html("[bấm](javascript:alert(1)) <img src=x onerror=alert(1)>");
        expect(out).not.toContain("href=\"javascript");
        expect(out).not.toContain("<img");
        expect(out).toContain("&lt;img");
    });

    it("// (protocol-relative) không được coi là liên kết nội bộ", () => {
        expect(html("[x](//evil.com)")).not.toContain("href");
    });
});

describe("tiện ích soạn bài", () => {
    it("bọc và gỡ dấu định dạng quanh vùng chọn", () => {
        const wrapped = toggleWrap("xin chào", 4, 8, "**", "chữ đậm");
        expect(wrapped.value).toBe("xin **chào**");
        const unwrapped = toggleWrap(wrapped.value, wrapped.start, wrapped.end, "**", "");
        expect(unwrapped.value).toBe("xin chào");
        expect(toggleWrap("", 0, 0, "~~", "gạch").value).toBe("~~gạch~~");
    });

    it("thêm/gỡ trích dẫn cho các dòng được chọn", () => {
        const quoted = toggleQuote("a\nb\nc", 2, 3);
        expect(quoted.value).toBe("a\n> b\nc");
        expect(toggleQuote(quoted.value, quoted.start, quoted.end).value).toBe("a\nb\nc");
        // Dòng trống, không chọn gì: con trỏ đứng sau "> " để gõ tiếp.
        const empty = toggleQuote("x\n", 2, 2);
        expect(empty).toEqual({ value: "x\n> ", start: 4, end: 4 });
    });

    it("bỏ markup cho bản xem trước; /map gắn khu vực", () => {
        expect(stripMarkup("**a** [b](/map?x=1)\n> c")).toBe("a b c");
        expect(internalHref("/admin/map", "/app")).toBe("/admin/map");
        expect(internalHref("/map?c=1", "/app")).toBe("/app/map?c=1");
    });
});
