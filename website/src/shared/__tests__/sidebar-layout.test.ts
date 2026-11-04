import { describe, expect, it } from "vitest";

import { isFocusPath } from "@/shared/components/layouts/sidebar.layout";

describe("isFocusPath", () => {
    it("dùng cột focus cho form đăng tin ở cả /app và /admin", () => {
        expect(isFocusPath("/app/properties/new")).toBe(true);
        expect(isFocusPath("/admin/properties/new")).toBe(true);
    });

    it("danh sách và chi tiết tin vẫn full-width", () => {
        expect(isFocusPath("/app/properties")).toBe(false);
        expect(isFocusPath("/admin/properties/nha-pho-hang-bac")).toBe(false);
    });

    it("giữ các đường dẫn focus cũ", () => {
        expect(isFocusPath("/app/notification")).toBe(true);
        expect(isFocusPath("/admin/settings/profile")).toBe(true);
    });
});
