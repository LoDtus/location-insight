import LOCALE from "@/shared/constants/locale.constant";
import type { Locale, LocaleMessages } from "@/shared/types/locale.types";

export function isSupportedLocale(value: string): value is Locale {
    return (LOCALE.SUPPORTED as readonly string[]).includes(value);
}

export function getLocaleValue(
    messages: LocaleMessages,
    path: string[],
): string {
    let current: unknown = messages;

    for (const key of path) {
        if (
            typeof current !== "object" ||
            current === null ||
            !(key in current)
        ) {
            return "";
        }

        current = (current as Record<string, unknown>)[key];
    }

    return typeof current === "string" ? current : "";
}

export function resolveLocale(value: string | undefined): Locale {
    if (value !== undefined && isSupportedLocale(value)) {
        return value;
    }

    return LOCALE.DEFAULT;
}
