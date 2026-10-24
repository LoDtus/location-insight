import "./landing.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import Footer from "@/features/landing-page/components/footer";
import Header from "@/features/landing-page/components/header";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import LandingHashScroll from "./landing-hash-scroll";
import ENV from "@/shared/constants/env.constant";
import { INDEXABLE_ROBOTS } from "@/shared/constants/seo.constant";
import { getLocaleValue } from "@/shared/utils/locale.utils";

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

    return (
        <div className="landing-shell relative flex h-full min-h-0 w-full flex-col">
            <a className="landing-skip" href="#noi-dung">
                {getLocaleValue(messages, ["skip"])}
            </a>
            <LandingHashScroll />
            <header>
                <Header />
            </header>
            <div className="landing-scroll">
                <main id="noi-dung" className="mx-auto w-full max-w-960">
                    {children}
                </main>
                <footer>
                    <Footer />
                </footer>
            </div>
        </div>
    );
}
