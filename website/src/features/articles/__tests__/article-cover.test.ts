import { describe, expect, it } from "vitest";

import { articleCoverSrc, isVectorCover } from "@/features/articles/article-cover";

describe("articleCoverSrc", () => {
    it("dùng ảnh bìa nội bộ khi bài có ảnh", () => {
        expect(articleCoverSrc({ coverImage: "/images/temp-002.jpg", topic: "gia" })).toBe("/images/temp-002.jpg");
    });

    it("dùng minh họa của chủ đề khi bài chưa có ảnh hoặc ảnh không phải đường dẫn nội bộ", () => {
        expect(articleCoverSrc({ coverImage: null, topic: "gia" })).toBe("/images/articles/cover-gia.svg");
        expect(articleCoverSrc({ coverImage: "https://evil.example/x.jpg", topic: "du-lieu" })).toBe("/images/articles/cover-du-lieu.svg");
    });

    it("chủ đề lạ vẫn có ảnh", () => {
        expect(articleCoverSrc({ coverImage: null, topic: "khac" })).toBe("/images/articles/cover-khu-vuc.svg");
    });

    it("nhận ra ảnh vector", () => {
        expect(isVectorCover("/images/articles/cover-gia.svg")).toBe(true);
        expect(isVectorCover("/images/temp-002.jpg")).toBe(false);
    });
});
