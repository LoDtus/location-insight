import { describe, expect, it } from "vitest";

import LANDING_PAGE_SEO from "@/features/landing-page/constants/landing-page-seo.constant";
import { isIndexablePath } from "@/shared/utils/seo.utils";

describe("seo.utils", () => {
    it("indexes every landing route", () => {
        Object.values(LANDING_PAGE_SEO.ROUTES).forEach((path) => {
            expect(isIndexablePath(path)).toBe(true);
        });
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
        ].forEach((path) => {
            expect(isIndexablePath(path)).toBe(false);
        });
    });
});
