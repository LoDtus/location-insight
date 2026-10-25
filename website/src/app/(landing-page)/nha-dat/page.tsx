import type { Metadata } from "next";
import { Suspense } from "react";

import ListingBrowser from "@/features/landing-page/components/listing-browser";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export async function generateMetadata(): Promise<Metadata> {
    const messages = await getLandingMessages();

    return {
        title: getLocaleValue(messages, ["catalog", "title"]),
        description: getLocaleValue(messages, ["catalog", "lede"]),
    };
}

export default async function Page() {
    const messages = await getLandingMessages();

    return (
        <Suspense
            fallback={
                <p className="m-0 px-4 py-8 text-base">
                    {getLocaleValue(messages, ["catalog", "loading"])}
                </p>
            }
        >
            <ListingBrowser />
        </Suspense>
    );
}
