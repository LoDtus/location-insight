import { describe, expect, it } from "vitest";

import LOCALE from "@/shared/constants/locale.constant";
import {
    getLocaleValue,
    isSupportedLocale,
    resolveLocale,
} from "@/shared/utils/locale.utils";

describe("locale.utils", () => {
    it("accepts vi and en", () => {
        expect(isSupportedLocale("vi")).toBe(true);
        expect(isSupportedLocale("en")).toBe(true);
        expect(isSupportedLocale("fr")).toBe(false);
    });

    it("reads a nested string", () => {
        expect(
            getLocaleValue({ api: { success: "Thành công" } }, ["api", "success"]),
        ).toBe("Thành công");
        expect(getLocaleValue({ api: { success: "Thành công" } }, ["api"])).toBe("");
    });

    it("falls back to the default locale", () => {
        expect(resolveLocale("en")).toBe(LOCALE.LOCALES.EN);
        expect(resolveLocale("fr")).toBe(LOCALE.DEFAULT);
        expect(resolveLocale(undefined)).toBe(LOCALE.DEFAULT);
    });
});
