import LOCALE from "@/shared/constants/locale.constant";

export type Locale = (typeof LOCALE.LOCALES)[keyof typeof LOCALE.LOCALES];

export type LocaleMessages = Record<string, unknown>;

export const LOCALE_FEATURES = ["shared", "error", "landing", "legal"] as const;

export type LocaleFeature = (typeof LOCALE_FEATURES)[number];
