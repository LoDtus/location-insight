import "server-only";

import { loadFeatureLocale } from "@/shared/services/locale.loader";
import { getLocale } from "@/shared/services/locale.service";
import type { LocaleMessages } from "@/shared/types/locale.types";

export async function getLandingMessages(): Promise<LocaleMessages> {
    return loadFeatureLocale("landing", await getLocale());
}
