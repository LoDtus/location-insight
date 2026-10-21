"use client";

import {
    loadFeatureTranslation,
    preferenceActions,
} from "@/features/preference/preference.slice";
import LOCALE from "@/shared/constants/locale.constant";
import {
    LOCALE_FEATURES,
    type Locale,
    type LocaleFeature,
    type LocaleMessages,
} from "@/shared/types/locale.types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import {
    createContext,
    useContext,
    useLayoutEffect,
    useTransition,
    type ReactNode,
} from "react";

export type LocaleContextValue = {
    locale: Locale;
    messages: Record<string, LocaleMessages>;
    isPending: boolean;
    setLocale: (locale: Locale) => void;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
    locale,
    messages,
    children,
}: {
    locale: Locale;
    messages: Record<string, LocaleMessages>;
    children: ReactNode;
}) {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const [isPending, startTransition] = useTransition();

    useLayoutEffect(() => {
        dispatch(
            preferenceActions.hydrateLocale({
                locale,
                translations: messages,
            }),
        );
    }, [dispatch, locale, messages]);

    const handleSetLocale = (nextLocale: Locale): void => {
        if (nextLocale === locale || isPending) {
            return;
        }

        const openFeatures = Object.keys(messages).filter(
            (feature): feature is LocaleFeature =>
                (LOCALE_FEATURES as readonly string[]).includes(feature),
        );

        startTransition(async () => {
            dispatch(preferenceActions.setLanguage(nextLocale));
            Cookies.set(LOCALE.COOKIE_NAME, nextLocale, {
                path: "/",
                expires: 365,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
            });
            await Promise.all(
                openFeatures.map((feature) =>
                    dispatch(
                        loadFeatureTranslation({
                            feature,
                            lang: nextLocale,
                        }),
                    ).unwrap(),
                ),
            );
            router.refresh();
        });
    };

    return (
        <LocaleContext.Provider
            value={{
                locale,
                messages,
                isPending,
                setLocale: handleSetLocale,
            }}
        >
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocaleContext(): LocaleContextValue {
    const context = useContext(LocaleContext);

    if (!context) {
        throw new Error("useLocaleContext must be used within LocaleProvider");
    }

    return context;
}

export function useLocaleMessages(feature: string): LocaleMessages {
    const contextMessages = useLocaleContext().messages[feature];
    const reduxMessages = useAppSelector(
        (state) => state.preference.translations[feature],
    );

    if (contextMessages !== undefined) {
        return contextMessages;
    }

    if (reduxMessages !== undefined) {
        return reduxMessages;
    }

    return {};
}
