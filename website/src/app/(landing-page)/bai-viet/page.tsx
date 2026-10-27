import type { Metadata } from "next";
import { Suspense } from "react";

import ArticleBrowser from "@/features/articles/components/article-browser";
import { loadPublishedArticles } from "@/features/articles/server/load-articles";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

function first(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function generateMetadata(): Promise<Metadata> {
    const messages = await getLandingMessages();

    return {
        title: getLocaleValue(messages, ["articles", "title"]),
        description: getLocaleValue(messages, ["articles", "lede"]),
    };
}

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const messages = await getLandingMessages();
    const list = await loadPublishedArticles({
        q: first(params.q),
        topic: first(params["chu-de"]),
        sort: first(params.sort),
        page: first(params.page),
    });

    return (
        <Suspense
            fallback={
                <p className="m-0 px-4 py-8 text-base">
                    {getLocaleValue(messages, ["articles", "loading"])}
                </p>
            }
        >
            <ArticleBrowser list={list} />
        </Suspense>
    );
}
