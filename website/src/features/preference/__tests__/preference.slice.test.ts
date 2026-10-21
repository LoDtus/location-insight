import Cookies from "js-cookie";
import { describe, expect, it, vi } from "vitest";

import LOCALE from "@/shared/constants/locale.constant";
import preferenceReducer, {
    PREFERENCE,
    preferenceActions,
    preferenceInitialState,
} from "@/features/preference/preference.slice";

vi.mock("js-cookie", () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

describe("preference.slice", () => {
    it("sets theme and persists cookie", () => {
        const nextState = preferenceReducer(
            preferenceInitialState,
            preferenceActions.setTheme("dark"),
        );

        expect(nextState.theme).toBe("dark");
        expect(Cookies.set).toHaveBeenCalledWith(
            PREFERENCE.THEME_COOKIE,
            "dark",
            expect.objectContaining({ path: "/" }),
        );
    });

    it("sets language and clears cached translations", () => {
        const currentState = {
            ...preferenceInitialState,
            lang: LOCALE.LOCALES.EN,
            translations: { shared: { hello: "Hello" } },
            loadingFeatures: { shared: true },
        };

        const nextState = preferenceReducer(
            currentState,
            preferenceActions.setLanguage(LOCALE.LOCALES.VI),
        );

        expect(nextState.lang).toBe(LOCALE.LOCALES.VI);
        expect(nextState.translations).toEqual({});
        expect(nextState.loadingFeatures).toEqual({});
    });
});
