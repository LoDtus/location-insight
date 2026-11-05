import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Serif_4 } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import Footer from "@/features/landing-page/components/footer";
import Header from "@/features/landing-page/components/header";
import { isLegalSectionPath } from "@/features/legal/legal-documents";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import LandingHashScroll from "./landing-hash-scroll";
import ENV from "@/shared/constants/env.constant";
import { INDEXABLE_ROBOTS } from "@/shared/constants/seo.constant";
import { getLocaleValue } from "@/shared/utils/locale.utils";
import { normalizePathname } from "@/shared/utils/seo.utils";

const displaySerif = Cormorant_Garamond({
    subsets: ["latin", "vietnamese"],
    weight: ["500", "600"],
    variable: "--font-display-serif",
    display: "swap",
});

const textSerif = Source_Serif_4({
    subsets: ["latin", "vietnamese"],
    variable: "--font-text-serif",
    display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
    const pathname = (await headers()).get("x-pathname") ?? "/";
    const canonical =
        pathname === "/" ? ENV.WEBSITE_URL : `${ENV.WEBSITE_URL}${pathname}`;

    return {
        robots: INDEXABLE_ROBOTS,
        alternates: { canonical },
    };
}

export default async function Layout({
    children,
}: {
    children: ReactNode;
}) {
    const messages = await getLandingMessages();
    const pathname = normalizePathname(
        (await headers()).get("x-pathname") ?? "/",
    );
    const isCatalog =
        pathname === "/nha-dat" ||
        pathname.startsWith("/nha-dat/") ||
        pathname === "/bai-viet" ||
        pathname.startsWith("/bai-viet/");
    const isDocument = isLegalSectionPath(pathname);
    const flush = isCatalog || isDocument;

    return (
        <div
            className={`${displaySerif.variable} ${textSerif.variable} relative flex h-full min-h-0 w-full flex-col bg-white font-serif text-charcoal [font-variant-numeric:lining-nums]`}
        >
            <a
                className="absolute top-2 left-4 z-10 -translate-y-[150%] bg-white px-4 py-2 focus:translate-y-0"
                href="#noi-dung"
            >
                {getLocaleValue(messages, ["skip"])}
            </a>
            <LandingHashScroll />
            <header className="bg-header text-cream">
                <Header />
            </header>
            <div className="flex min-h-0 flex-1 flex-col overflow-auto scroll-smooth [container-type:size] motion-reduce:scroll-auto">
                <main
                    id="noi-dung"
                    className={flush ? "w-full" : "flex w-full flex-col"}
                >
                    {children}
                </main>
                <footer className="bg-charcoal text-cream">
                    <Footer />
                </footer>
            </div>
        </div>
    );
}
