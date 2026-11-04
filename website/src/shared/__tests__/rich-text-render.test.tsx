import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RichTextContent from "@/shared/components/editor/rich-text-content";
import RichTextEditor from "@/shared/components/editor/rich-text-editor";
import type { RichTextDoc } from "@/shared/components/editor/rich-text.types";

vi.mock("@/shared/hooks/useLocale", () => ({ useLocale: () => ({ locale: "vi" }) }));

const doc: RichTextDoc = {
    type: "doc",
    content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Điểm nổi bật" }] },
        {
            type: "paragraph",
            content: [
                { type: "text", text: "Gần " },
                { type: "text", text: "hồ", marks: [{ type: "bold" }] },
                { type: "text", text: " xem tại " },
                { type: "text", text: "đây", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
            ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Sổ đỏ" }] }] }] },
    ],
};

describe("RichTextContent", () => {
    it("dựng tiêu đề, chữ đậm, danh sách và liên kết có rel an toàn", () => {
        render(<RichTextContent doc={doc} />);
        expect(screen.getByRole("heading", { level: 2, name: "Điểm nổi bật" })).toBeTruthy();
        expect(screen.getByText("hồ").closest("strong")).not.toBeNull();
        expect(screen.getByText("Sổ đỏ").closest("li")).not.toBeNull();
        const link = screen.getByRole("link", { name: "đây" });
        expect(link.getAttribute("href")).toBe("https://example.com");
        expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("không dựng thẻ script hay thuộc tính sự kiện từ nút lạ", () => {
        const hostile: RichTextDoc = {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] }],
        };
        const { container } = render(<RichTextContent doc={hostile} />);
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("script")).toBeNull();
        expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    });
});

describe("RichTextEditor", () => {
    it("hiển thị thanh công cụ có nhãn tiếng Việt và vùng soạn thảo", async () => {
        render(<RichTextEditor onChange={() => undefined} ariaLabel="Mô tả" placeholder="Giới thiệu" />);
        expect(await screen.findByRole("textbox", { name: "Mô tả" })).toBeTruthy();
        expect(screen.getByRole("toolbar", { name: "Định dạng văn bản" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "In đậm" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Danh sách chấm" })).toBeTruthy();
    });
});
