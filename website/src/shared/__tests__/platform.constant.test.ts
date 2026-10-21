import { describe, expect, it } from "vitest";

import { isErrorSlug } from "@/shared/constants/error.constant";
import RUNTIME from "@/shared/constants/runtime.constant";

describe("platform constants", () => {
    it("uses different public urls per environment", () => {
        expect(RUNTIME.development.siteUrl).not.toBe(RUNTIME.production.siteUrl);
        expect(RUNTIME.development.apiUrl).not.toBe(RUNTIME.production.apiUrl);
    });

    it("accepts english error slugs", () => {
        expect(isErrorSlug("not-found")).toBe(true);
        expect(isErrorSlug("khong-thay")).toBe(false);
    });
});
