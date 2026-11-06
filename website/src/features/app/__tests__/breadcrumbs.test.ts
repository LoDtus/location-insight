import { describe, expect, it } from "vitest";

import { buildCrumbs } from "@/features/app/breadcrumbs";

describe("buildCrumbs", () => {
    it("tab gốc chỉ có Trang chủ và tên tab, tab là mục hiện tại", () => {
        expect(buildCrumbs("/admin/users", true)).toEqual([
            { label: "Trang chủ", href: "/admin/properties" },
            { label: "Người dùng", href: undefined },
        ]);
    });

    it("trang tạo mới có thêm mục cuối", () => {
        const crumbs = buildCrumbs("/app/properties/new", true);
        expect(crumbs?.map((c) => c.label)).toEqual(["Trang chủ", "Tin rao bán", "Đăng tin mới"]);
        expect(crumbs?.[1]?.href).toBe("/app/properties");
    });

    it("hồ sơ lấy tên người dùng từ đường dẫn", () => {
        expect(buildCrumbs("/app/profile/%40an", true)?.at(-1)?.label).toBe("@an");
    });

    it("chi tiết tin dùng đường dẫn riêng nên bỏ qua", () => {
        expect(buildCrumbs("/app/properties/nha-pho", true)).toBeNull();
    });

    it("diễn đàn không dùng đường dẫn (trang chi tiết bài có nút ← riêng)", () => {
        expect(buildCrumbs("/app/feed", true)).toBeNull();
        expect(buildCrumbs("/admin/feed", true)).toBeNull();
        expect(buildCrumbs("/app/feed/abc", true)).toBeNull();
    });

    it("tab không có trang con và bản đồ/tin nhắn không hiện", () => {
        expect(buildCrumbs("/app/notification", true)).toBeNull();
        expect(buildCrumbs("/app/map", true)).toBeNull();
        expect(buildCrumbs("/admin/messages/abc", true)).toBeNull();
    });
});
