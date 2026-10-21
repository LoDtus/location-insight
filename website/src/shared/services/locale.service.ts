import "server-only";

import LOCALE from "@/shared/constants/locale.constant";
import type { Locale } from "@/shared/types/locale.types";
import { isSupportedLocale } from "@/shared/utils/locale.utils";

export async function getLocale(): Promise<Locale> {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const locale = cookieStore.get(LOCALE.COOKIE_NAME)?.value;

    if (locale && isSupportedLocale(locale)) {
        return locale;
    }

    return LOCALE.DEFAULT;
}
