import {
    createSlice,
    createAsyncThunk,
    type PayloadAction,
} from "@reduxjs/toolkit";
import Cookies from "js-cookie";

import LOCALE from "@/shared/constants/locale.constant";
import { loadFeatureLocale } from "@/shared/services/locale.loader";
import type {
    Locale,
    LocaleFeature,
    LocaleMessages,
} from "@/shared/types/locale.types";
import { isSupportedLocale } from "@/shared/utils/locale.utils";

export const PREFERENCE = {
    PERSIST_KEY: "location_insight_preference",
    THEME_COOKIE: "theme",
    THEME_COOKIE_EXPIRES_DAYS: 365,
} as const;

export type Theme = "light" | "dark";

export type PreferenceState = {
    theme: Theme;
    lang: Locale;
    translations: Record<string, LocaleMessages>;
    loadingFeatures: Record<string, boolean>;
};

function readThemeCookie(): Theme {
    if (typeof document === "undefined") {
        return "light";
    }

    return Cookies.get(PREFERENCE.THEME_COOKIE) === "dark" ? "dark" : "light";
}

function readLangFromDocument(): Locale {
    if (typeof document === "undefined") {
        return LOCALE.DEFAULT;
    }

    return isSupportedLocale(document.documentElement.lang)
        ? document.documentElement.lang
        : LOCALE.DEFAULT;
}

export const preferenceInitialState: PreferenceState = {
    theme: "light",
    lang: LOCALE.DEFAULT,
    translations: {},
    loadingFeatures: {},
};

export const loadFeatureTranslation = createAsyncThunk(
    "preference/loadFeatureTranslation",
    async ({
        feature,
        lang,
    }: {
        feature: LocaleFeature;
        lang: Locale;
    }) => {
        const data = await loadFeatureLocale(feature, lang);
        return { feature, data };
    },
);

const preferenceSlice = createSlice({
    name: "preference",
    initialState: preferenceInitialState,
    reducers: {
        setTheme: (state, action: PayloadAction<Theme>) => {
            state.theme = action.payload;
            Cookies.set(PREFERENCE.THEME_COOKIE, action.payload, {
                expires: PREFERENCE.THEME_COOKIE_EXPIRES_DAYS,
                path: "/",
                sameSite: "lax",
            });
        },
        setLanguage: (state, action: PayloadAction<Locale>) => {
            state.lang = action.payload;
            state.translations = {};
            state.loadingFeatures = {};
        },
        hydrateLocale: (
            state,
            action: PayloadAction<{
                locale: Locale;
                translations: Record<string, LocaleMessages>;
            }>,
        ) => {
            state.lang = action.payload.locale;
            state.translations = {
                ...state.translations,
                ...action.payload.translations,
            };
        },
        rehydrateFromClient: (state) => {
            state.theme = readThemeCookie();
            state.lang = readLangFromDocument();
            state.translations = {};
            state.loadingFeatures = {};
        },
        resetPreference: () => preferenceInitialState,
    },
    extraReducers: (builder) => {
        builder
            .addCase(loadFeatureTranslation.pending, (state, action) => {
                state.loadingFeatures[action.meta.arg.feature] = true;
            })
            .addCase(loadFeatureTranslation.fulfilled, (state, action) => {
                const { feature, data } = action.payload;
                state.translations[feature] = data;
                state.loadingFeatures[feature] = false;
            })
            .addCase(loadFeatureTranslation.rejected, (state, action) => {
                state.loadingFeatures[action.meta.arg.feature] = false;
            });
    },
});

export const preferenceActions = preferenceSlice.actions;
export default preferenceSlice.reducer;
