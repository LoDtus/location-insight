import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RichTextMarkdownContent from "@/shared/components/editor/rich-text-markdown-content";
import { safeImageSrc } from "@/shared/components/editor/rich-text-image";

describe("ảnh trong bài viết", () => {
    it("Markdown ![mô tả](src \"chú thích\") thành ảnh có chú thích, mở được bằng trình xem", () => {
        render(<RichTextMarkdownContent variant="article" source={'Mở đầu\n\n![Khu căn hộ](/images/temp-004.jpg "Nhìn từ trên cao")\n\nKết'} />);
        const image = screen.getByRole("img", { name: "Khu căn hộ" });
        expect(image.getAttribute("src")).toBe("/images/temp-004.jpg");
        expect(image.hasAttribute("data-lightbox")).toBe(true);
        expect(screen.getByText("Nhìn từ trên cao").tagName).toBe("FIGCAPTION");
    });

    it("bỏ ảnh có nguồn không an toàn", () => {
        const { container } = render(<RichTextMarkdownContent variant="article" source={"![x](javascript:alert(1))\n\n![y](http://a.vn/b.jpg)"} />);
        expect(container.querySelector("img")).toBeNull();
    });

    it("chỉ nhận đường dẫn nội bộ hoặc https", () => {
        expect(safeImageSrc("/images/a.jpg")).toBe("/images/a.jpg");
        expect(safeImageSrc("https://cdn.vn/a.jpg")).toBe("https://cdn.vn/a.jpg");
        expect(safeImageSrc("//evil.vn/a.jpg")).toBeNull();
        expect(safeImageSrc("data:image/png;base64,AAAA")).toBeNull();
        expect(safeImageSrc("http://a.vn/a.jpg")).toBeNull();
    });

    it("mô tả ngắn (không phải bài viết) không dựng ảnh", () => {
        const { container } = render(<RichTextMarkdownContent source={"![x](/images/temp-004.jpg)"} />);
        expect(container.querySelector("img")).toBeNull();
    });
});
