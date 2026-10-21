import "./globals.css";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { ReactNode } from "react";

import COLOR from "@/shared/constants/color.constant";
import ENV from "@/shared/constants/env.constant";
import AppProvider from "@/shared/providers/app.provider";
import { LocaleProvider } from "@/shared/providers/locale.provider";
import { loadFeatureLocale } from "@/shared/services/locale.loader";
import { getLocale } from "@/shared/services/locale.service";

export const metadata: Metadata = {
    title: ENV.APP_NAME,
    description: ENV.APP_DESCRIPTION,
};

export default async function RootLayout({
    children,
}: {
    children: ReactNode;
}) {
    const locale = await getLocale();
    const sharedMessages = await loadFeatureLocale("shared", locale);

    return (
        <html
            lang={locale}
            suppressHydrationWarning
            data-scroll-behavior="smooth"
            className="w-full h-full antialiased"
        >
            <head />
            <body className="w-full h-full flex flex-col overflow-hidden">
                <NextTopLoader
                    color={COLOR.PRIMARY}
                    height={2}
                    showSpinner={false}
                    speed={300}
                    crawlSpeed={100}
                />
                <AppProvider>
                    <LocaleProvider
                        locale={locale}
                        messages={{ shared: sharedMessages }}
                    >
                        {children}
                    </LocaleProvider>
                </AppProvider>
            </body>
        </html>
    );
}
