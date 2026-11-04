import { describe, expect, it } from "vitest";

import { articleChecklist, blockingIssues, hasInternalLink, slugifyTitle } from "@/features/articles/article-rules";
import type { ArticleWrite } from "@/features/articles/articles.api";

function form(overrides: Partial<ArticleWrite> = {}): ArticleWrite {
    return {
        title: "Bán kính 500 mét đang đo cái gì",
        slug: "ban-kinh-500-met",
        lede: "Đoạn dẫn đủ dài để qua kiểm tra của bài viết.",
        body: `${"Nội dung bài viết. ".repeat(14)} Xem [nhà đất](/nha-dat).`,
        topic: "cach-doc",
        status: "published",
        publishedAt: null,
        coverImage: null,
        seoTitle: null,
        seoDescription: null,
        ...overrides,
    };
}

describe("slugifyTitle", () => {
    it("bỏ dấu, đ→d và gạch nối", () => {
        expect(slugifyTitle("Đường Láng: giá bao nhiêu?")).toBe("duong-lang-gia-bao-nhieu");
    });
});

describe("articleChecklist", () => {
    it("bài đủ điều kiện không còn mục bắt buộc nào chưa xong", () => {
        expect(blockingIssues(form())).toEqual([]);
    });

    it("thiếu liên kết nội bộ thì bị chặn khi đăng nhưng nháp thì không", () => {
        const body = "Nội dung dài. ".repeat(20);
        expect(hasInternalLink(body)).toBe(false);
        expect(blockingIssues(form({ body }))).toContain("Có liên kết nội bộ (/nha-dat, /phap-ly, /bai-viet/)");
        expect(blockingIssues(form({ body, status: "draft" }))).toEqual([]);
    });

    it("nháp vẫn cần tiêu đề và slug", () => {
        expect(blockingIssues(form({ title: "", slug: "", status: "draft" })).length).toBe(2);
    });

    it("mục tối ưu tìm kiếm không bắt buộc", () => {
        const optional = articleChecklist(form()).filter((item) => !item.required);
        expect(optional.every((item) => !item.done)).toBe(true);
    });
});
