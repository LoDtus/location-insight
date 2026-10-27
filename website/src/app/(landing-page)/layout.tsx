import type { Metadata } from "next";
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
        <div className="relative flex h-full min-h-0 w-full flex-col">
            <a
                className="absolute top-2 left-50 z-10 -translate-y-[150%] focus:translate-y-0"
                href="#noi-dung"
            >
                {getLocaleValue(messages, ["skip"])}
            </a>
            <LandingHashScroll />
            <header className="border-b border-cream/30 bg-header text-cream">
                <Header />
            </header>
            <div
                className={`flex min-h-0 flex-1 flex-col overflow-auto scroll-smooth [container-type:size] motion-reduce:scroll-auto ${flush ? "" : "gap-[150px]"}`}
            >
                <main
                    id="noi-dung"
                    className={
                        flush
                            ? "w-full"
                            : "mx-auto flex w-full max-w-960 flex-col gap-[150px] border"
                    }
                >
                    {children}
                </main>
                <footer className="border-t border-current">
                    <Footer />
                </footer>
            </div>
        </div>
    );
}
