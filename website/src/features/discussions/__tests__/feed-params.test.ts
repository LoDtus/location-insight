import { describe, expect, it } from "vitest";

import { readFeedView, writeFeedView } from "@/features/discussions/feed-params";

describe("readFeedView", () => {
    it("không có tham số thì là Mới nhất", () => {
        expect(readFeedView("")).toEqual({ scope: "all", topic: "" });
    });

    it("đọc chủ đề và mục đang theo dõi", () => {
        expect(readFeedView("?chu-de=mua-nha")).toEqual({ scope: "all", topic: "mua-nha" });
        expect(readFeedView("?muc=dang-theo-doi")).toEqual({ scope: "following", topic: "" });
    });

    it("đang theo dõi được ưu tiên hơn chủ đề", () => {
        expect(readFeedView("?muc=dang-theo-doi&chu-de=mua-nha")).toEqual({ scope: "following", topic: "" });
    });

    it("slug không hợp lệ thì bỏ qua", () => {
        expect(readFeedView("?chu-de=%3Cscript%3E").topic).toBe("");
        expect(readFeedView("?chu-de=Mua-Nha").topic).toBe("");
        expect(readFeedView(`?chu-de=${"a".repeat(81)}`).topic).toBe("");
        expect(readFeedView("?muc=khac").scope).toBe("all");
    });
});

describe("writeFeedView", () => {
    it("Mới nhất xóa sạch bộ lọc nhưng giữ tham số khác", () => {
        expect(writeFeedView("?chu-de=mua-nha&x=1", { scope: "all", topic: "" })).toBe("?x=1");
        expect(writeFeedView("?muc=dang-theo-doi", { scope: "all", topic: "" })).toBe("");
    });

    it("chuyển giữa chủ đề và đang theo dõi không để lại tham số cũ", () => {
        expect(writeFeedView("?chu-de=mua-nha", { scope: "following", topic: "" })).toBe("?muc=dang-theo-doi");
        expect(writeFeedView("?muc=dang-theo-doi", { scope: "all", topic: "thue" })).toBe("?chu-de=thue");
    });
});
