import { describe, expect, it } from "vitest";

import { ARTICLES } from "@/features/articles/articles";
import { filterArticles, type ArticleSearchItem } from "@/features/articles/articles-search";

const ITEMS: ArticleSearchItem[] = ARTICLES.map((article) => ({
    ...article,
    title: article.slug,
    lede: article.topic,
    topicLabel: article.topic,
}));

describe("filterArticles", () => {
    it("bỏ dấu khi tìm", () => {
        const found = filterArticles(
            [
                {
                    ...ITEMS[0],
                    title: "Bán kính 500 mét",
                    lede: "Đo tiện ích đi bộ.",
                    topicLabel: "Cách đọc",
                },
            ],
            "ban kinh",
            "",
            "moi",
            "vi",
        );

        expect(found).toHaveLength(1);
    });

    it("lọc đúng chủ đề và sắp cũ trước", () => {
        const found = filterArticles(ITEMS, "", "gia", "cu", "vi");

        expect(found.every((item) => item.topic === "gia")).toBe(true);
        expect(found.map((item) => item.publishedAt)).toEqual(
            [...found.map((item) => item.publishedAt)].sort(),
        );
    });

    it("không trả bài ngoài từ khóa", () => {
        expect(filterArticles(ITEMS, "khong-co-bai-nay", "", "moi", "vi")).toHaveLength(0);
    });
});
