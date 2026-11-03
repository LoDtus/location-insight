import { describe, expect, it } from "vitest";

import { backoffMs } from "./messaging.realtime";
import {
    fileKindOf,
    formatBytes,
    needsSeparator,
    peerLabel,
    presenceText,
    safeHttpUrl,
    sameGroup,
    splitLinks,
} from "./messaging.format";

describe("splitLinks", () => {
    it("tách liên kết, bỏ dấu câu cuối, không sinh HTML", () => {
        expect(splitLinks("xem https://a.vn/x?y=1, nhé")).toEqual([
            { type: "text", value: "xem " },
            { type: "link", value: "https://a.vn/x?y=1" },
            { type: "text", value: ", nhé" },
        ]);
        expect(splitLinks("<b>không</b>")).toEqual([{ type: "text", value: "<b>không</b>" }]);
        expect(splitLinks("javascript:alert(1)")).toEqual([{ type: "text", value: "javascript:alert(1)" }]);
    });
});

describe("gom cụm và dải thời gian", () => {
    it("cùng người trong 3 phút thì gộp", () => {
        const a = { senderId: "x", createdAt: "2026-11-02T10:00:00.000Z" };
        expect(sameGroup(a, { senderId: "x", createdAt: "2026-11-02T10:02:00.000Z" })).toBe(true);
        expect(sameGroup(a, { senderId: "x", createdAt: "2026-11-02T10:04:00.000Z" })).toBe(false);
        expect(sameGroup(a, { senderId: "y", createdAt: "2026-11-02T10:01:00.000Z" })).toBe(false);
    });
    it("dải thời gian khi cách hơn 30 phút hoặc khác ngày", () => {
        expect(needsSeparator(undefined, "2026-11-02T10:00:00.000Z")).toBe(true);
        expect(needsSeparator("2026-11-02T10:00:00.000Z", "2026-11-02T10:20:00.000Z")).toBe(false);
        expect(needsSeparator("2026-11-02T10:00:00.000Z", "2026-11-02T10:40:00.000Z")).toBe(true);
    });
});

describe("presenceText", () => {
    const now = Date.parse("2026-11-02T12:00:00.000Z");
    it("các trạng thái", () => {
        expect(presenceText(null, now)).toBe("");
        expect(presenceText({ online: true, lastActiveAt: null }, now)).toBe("Đang hoạt động");
        expect(presenceText({ online: false, lastActiveAt: "2026-11-02T02:50:00.000Z" }, now)).toBe("Hoạt động 9 giờ trước");
        expect(presenceText({ online: false, lastActiveAt: null }, now)).toBe("");
    });
});

describe("backoffMs", () => {
    it("tăng theo cấp số nhân, tối đa 30 giây, có nhiễu ±20%", () => {
        expect(backoffMs(0, 0.5)).toBe(1000);
        expect(backoffMs(2, 0.5)).toBe(4000);
        expect(backoffMs(10, 0.5)).toBe(30000);
        expect(backoffMs(0, 0)).toBe(800);
        expect(backoffMs(0, 1)).toBe(1200);
    });
});

describe("peerLabel", () => {
    const peer = { displayName: "Lan Anh" };
    it("ưu tiên biệt danh, bỏ qua biệt danh chỉ có khoảng trắng", () => {
        expect(peerLabel({ nickname: "Lan Anh (hàng xóm)", peer })).toBe("Lan Anh (hàng xóm)");
        expect(peerLabel({ nickname: null, peer })).toBe("Lan Anh");
        expect(peerLabel({ nickname: "   ", peer })).toBe("Lan Anh");
    });
});

describe("formatBytes", () => {
    it("đổi sang đơn vị dễ đọc, dùng dấu phẩy thập phân", () => {
        expect(formatBytes(148)).toBe("148 B");
        expect(formatBytes(1536)).toBe("1,5 KB");
        expect(formatBytes(20 * 1024)).toBe("20 KB");
        expect(formatBytes(3.4 * 1024 * 1024)).toBe("3,4 MB");
        expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    });
});

describe("fileKindOf", () => {
    it("nhận loại theo đuôi tệp, không phân biệt hoa thường", () => {
        expect(fileKindOf("Hop-dong.PDF")).toBe("pdf");
        expect(fileKindOf("bao cao.docx")).toBe("word");
        expect(fileKindOf("gia.xlsx")).toBe("sheet");
        expect(fileKindOf("gia.csv")).toBe("sheet");
        expect(fileKindOf("slide.pptx")).toBe("slide");
        expect(fileKindOf("ghi-chu.txt")).toBe("text");
        expect(fileKindOf("khongduoi")).toBe("text");
    });
});

describe("safeHttpUrl", () => {
    it("chỉ cho http và https", () => {
        expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
        expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
        expect(safeHttpUrl("data:text/html,x")).toBeNull();
        expect(safeHttpUrl("không phải url")).toBeNull();
    });
});
