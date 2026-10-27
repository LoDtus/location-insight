import type { Metadata } from "next";
import { Suspense } from "react";

import ArticleBrowser from "@/features/articles/components/article-browser";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export async function generateMetadata(): Promise<Metadata> {
    const messages = await getLandingMessages();

    return {
        title: getLocaleValue(messages, ["articles", "title"]),
        description: getLocaleValue(messages, ["articles", "lede"]),
    };
}

export default async function Page() {
    const messages = await getLandingMessages();

    return (
        <Suspense
            fallback={
                <p className="m-0 px-4 py-8 text-base">
                    {getLocaleValue(messages, ["articles", "loading"])}
                </p>
            }
        >
            <ArticleBrowser />
        </Suspense>
    );
}
