import { describe, expect, it } from "vitest";

import LANDING_PAGE_SEO from "@/features/landing-page/constants/landing-page-seo.constant";
import { isIndexablePath } from "@/shared/utils/seo.utils";

describe("seo.utils", () => {
    it("indexes every landing route", () => {
        Object.values(LANDING_PAGE_SEO.ROUTES).forEach((path) => {
            expect(isIndexablePath(path)).toBe(true);
        });
    });

    it("indexes public legal documents and keeps internal ones out", () => {
        expect(isIndexablePath("/phap-ly")).toBe(true);
        expect(isIndexablePath("/phap-ly/dieu-khoan")).toBe(true);
        expect(isIndexablePath("/phap-ly/chinh-sach-bao-mat")).toBe(true);
        expect(isIndexablePath("/phap-ly/thue")).toBe(false);
        expect(isIndexablePath("/phap-ly/thoa-thuan-api")).toBe(false);
        expect(isIndexablePath("/dieu-khoan")).toBe(false);
        expect(isIndexablePath("/bai-viet")).toBe(true);
        expect(isIndexablePath("/bai-viet/ban-kinh-500-met")).toBe(true);
        expect(isIndexablePath("/bai-viet/Khong Hop")).toBe(false);
    });

    it("keeps application routes out of the index", () => {
        [
            "/auth/login",
            "/auth/register",
            "/auth/fogot-password",
            "/auth/reset-password",
            "/app",
            "/admin",
            "/error",
            "/error/not-found",
            "/color",
            "/ban-do",
            "/bang-gia",
            "/cach-hoat-dong",
            "/cau-hoi-thuong-gap",
        ].forEach((path) => {
            expect(isIndexablePath(path)).toBe(false);
        });
    });
});
