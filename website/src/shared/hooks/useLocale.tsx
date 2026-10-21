"use client";

import {
    useLocaleContext,
    useLocaleMessages,
} from "@/shared/providers/locale.provider";

export function useLocale() {
    return useLocaleContext();
}

export { useLocaleMessages };
