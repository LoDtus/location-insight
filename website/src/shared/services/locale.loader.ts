import LOCALE from "@/shared/constants/locale.constant";
import type {
    Locale,
    LocaleFeature,
    LocaleMessages,
} from "@/shared/types/locale.types";

type LocaleModuleLoader = () => Promise<{ default: LocaleMessages }>;

const LOADERS: Record<LocaleFeature, Record<Locale, LocaleModuleLoader>> = {
    shared: {
        vi: () => import("@/shared/locales/vi.json"),
        en: () => import("@/shared/locales/en.json"),
    },
    error: {
        vi: () => import("@/features/error/locales/vi.json"),
        en: () => import("@/features/error/locales/en.json"),
    },
};

function unwrapLocaleModule(
    loaded: { default: LocaleMessages } | LocaleMessages,
): LocaleMessages {
    if (
        loaded !== null &&
        typeof loaded === "object" &&
        "default" in loaded &&
        loaded.default !== null &&
        typeof loaded.default === "object"
    ) {
        return loaded.default as LocaleMessages;
    }

    return loaded as LocaleMessages;
}

export async function loadFeatureLocale(
    feature: LocaleFeature,
    locale: Locale,
): Promise<LocaleMessages> {
    try {
        return unwrapLocaleModule(await LOADERS[feature][locale]());
    } catch {
        return unwrapLocaleModule(await LOADERS[feature][LOCALE.DEFAULT]());
    }
}
