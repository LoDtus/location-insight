import { describe, expect, it } from "vitest";

import { isErrorSlug } from "@/shared/constants/error.constant";
import ENV from "@/shared/constants/env.constant";
import RUNTIME from "@/shared/constants/runtime.constant";

describe("platform constants", () => {
    it("uses different public urls per environment", () => {
        expect(RUNTIME.development.siteHost).not.toBe(RUNTIME.production.siteHost);
        expect(RUNTIME.development.apiUrl).not.toBe(RUNTIME.production.apiUrl);
    });

    it("reads the website port from the root env file", () => {
        expect(process.env.WEBSITE_PORT).toMatch(/^[0-9]+$/);
        expect(ENV.WEBSITE_PORT).toBe(Number(process.env.WEBSITE_PORT));
        expect(ENV.WEBSITE_URL).toBe(
            `http://127.0.0.1:${process.env.WEBSITE_PORT}`,
        );
    });

    it("accepts english error slugs", () => {
        expect(isErrorSlug("not-found")).toBe(true);
        expect(isErrorSlug("khong-thay")).toBe(false);
    });
});
