import Image from "next/image";
import Link from "next/link";
import type { JSX } from "react";

import type { PublicArticle } from "@/features/articles/articles";
import ArticleAdminBar from "@/features/articles/components/article-admin-bar";
import ArticleComments from "@/features/articles/components/article-comments";
import ArticleEngagementProvider from "@/features/articles/components/article-engagement-provider";
import ArticleRelated from "@/features/articles/components/article-related";
import ArticleToc from "@/features/articles/components/article-toc";
import ArticleVoteBar from "@/features/articles/components/article-vote-bar";
import RichTextMarkdownContent from "@/shared/components/editor/rich-text-markdown-content";
import { markdownToDoc, withHeadingIds } from "@/shared/components/editor/rich-text-markdown";

export type ArticleViewData = PublicArticle & {
    body: string;
    author: { name: string; username: string | null; avatarUrl: string | null };
    stats: { upvotes: number; downvotes: number; comments: number };
};

export type ArticleViewText = {
    back: string;
    topic: string;
    toc: string;
    related: string;
    byline: string;
    published: string;
    preview: string;
};

function initials(name: string): string {
    return (name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("") || "?").toLocaleUpperCase("vi");
}

/**
 * Bố cục bài viết ba cột: mục lục (trái, dán), nội dung (giữa, chiếm hết chỗ còn lại), bài liên quan (phải, dán).
 * Dùng cho cả trang công khai và bản xem trước của admin với bài chưa đăng.
 */
export default function ArticleView({
    article,
    related,
    topics,
    locale,
    text,
    preview = false,
}: {
    article: ArticleViewData;
    related: PublicArticle[];
    topics: Record<string, string>;
    locale: string;
    text: ArticleViewText;
    /** Bản xem trước của bài chưa công khai: không có tương tác, chỉ có nút quản trị. */
    preview?: boolean;
}): JSX.Element {
    const { headings } = withHeadingIds(markdownToDoc(article.body));
    return (
        <ArticleEngagementProvider slug={article.slug} initialStats={article.stats}>
            <div className="mx-auto box-border w-full max-w-screen-2xl px-4 py-8 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                        href="/bai-viet"
                        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    >
                        {text.back}
                    </Link>
                    <ArticleAdminBar slug={article.slug} />
                </div>
                <div className="mt-4 grid items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_19rem] xl:gap-10">
                    <div className="sticky top-6 hidden max-h-[calc(100vh-3rem)] self-start overflow-y-auto lg:block">
                        <ArticleToc headings={headings} title={text.toc} />
                    </div>
                    <article className="min-w-0">
                        <header>
                            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-charcoal/75">
                                <span className="rounded-full bg-green/15 px-3 py-0.5 font-semibold text-green">{text.topic}</span>
                                {text.published ? <time dateTime={article.publishedAt ?? undefined}>{text.published}</time> : null}
                                {preview ? <span className="font-semibold text-red-700">{text.preview}</span> : null}
                            </p>
                            <h1 className="mt-3 mb-0 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">{article.title}</h1>
                            <p className="mt-3 mb-0 text-lg leading-relaxed text-charcoal/80">{article.lede}</p>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-charcoal/15 py-3">
                                <p className="m-0 flex items-center gap-2.5 text-sm">
                                    <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-green/15 font-sans text-xs font-semibold text-green">
                                        {initials(article.author.name)}
                                    </span>
                                    <span>
                                        <span className="block text-xs text-charcoal/60">{text.byline}</span>
                                        <b>{article.author.name}</b>
                                    </span>
                                </p>
                                <ArticleVoteBar compact />
                            </div>
                        </header>
                        {article.coverImage?.startsWith("/") ? (
                            <Image
                                src={article.coverImage}
                                alt=""
                                width={1200}
                                height={675}
                                priority
                                className="mt-6 aspect-video w-full rounded-2xl object-cover"
                            />
                        ) : null}
                        <div className="mt-6">
                            <RichTextMarkdownContent source={article.body} variant="article" />
                        </div>
                        {preview ? null : (
                            <div className="mt-10">
                                <div className="mb-8">
                                    <ArticleVoteBar />
                                </div>
                                <ArticleComments />
                            </div>
                        )}
                    </article>
                    <div className="sticky top-6 hidden max-h-[calc(100vh-3rem)] self-start overflow-y-auto xl:block">
                        <ArticleRelated items={related} title={text.related} topics={topics} locale={locale} />
                    </div>
                </div>
                <div className="mt-10 border-t border-charcoal/15 pt-6 xl:hidden">
                    <ArticleRelated items={related} title={text.related} topics={topics} locale={locale} />
                </div>
            </div>
        </ArticleEngagementProvider>
    );
}
