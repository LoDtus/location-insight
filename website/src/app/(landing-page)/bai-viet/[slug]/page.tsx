import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArticleMarkdown from "@/features/articles/components/article-markdown";
import { loadPublishedArticle } from "@/features/articles/server/load-articles";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocale } from "@/shared/services/locale.service";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const article = await loadPublishedArticle(slug);
    if (!article) return { title: "Bài viết" };

    return {
        title: article.seoTitle || article.title,
        description: article.seoDescription || article.lede,
    };
}

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const article = await loadPublishedArticle(slug);
    if (!article) notFound();

    const [messages, locale] = await Promise.all([getLandingMessages(), getLocale()]);
    const topic = getLocaleValue(messages, ["articles", "topics", article.topic]);
    const published = article.publishedAt
        ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
          }).format(new Date(article.publishedAt))
        : "";

    return (
        <article className="box-border px-4 py-8 sm:px-8 xl:px-50">
            <p className="m-0">
                <Link
                    href="/bai-viet"
                    className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                >
                    {getLocaleValue(messages, ["articles", "title"])}
                </Link>
            </p>
            <header className="mt-4 max-w-3xl">
                <p className="m-0 text-sm text-charcoal/75">
                    {topic}
                    {published ? ` · ${published}` : ""}
                </p>
                <h1 className="mt-2 mb-0 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                    {article.title}
                </h1>
                <p className="mt-3 text-base leading-relaxed text-charcoal/75">{article.lede}</p>
            </header>
            {article.coverImage?.startsWith("/") ? (
                <Image
                    src={article.coverImage}
                    alt=""
                    width={1200}
                    height={675}
                    priority
                    className="mt-6 aspect-video w-full max-w-3xl rounded-2xl object-cover"
                />
            ) : null}
            <div className="mt-6 max-w-3xl">
                <ArticleMarkdown source={article.body} />
            </div>
        </article>
    );
}
