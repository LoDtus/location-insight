"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
    ARTICLES,
    ARTICLE_PAGE_SIZE,
    ARTICLE_SORTS,
    ARTICLE_TOPICS,
} from "@/features/articles/articles";
import {
    filterArticles,
    readArticlePage,
    readArticleSort,
    readArticleTopic,
    type ArticleSearchItem,
} from "@/features/articles/articles-search";
import Pagination from "@/shared/components/ui/pagination";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const FIELD_CLASS =
    "box-border min-h-11 w-full rounded-full border border-charcoal/20 bg-white px-4 text-sm text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

const CHIP_CLASS =
    "inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/20 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

export default function ArticleBrowser() {
    const router = useRouter();
    const params = useSearchParams();
    const landing = useLocaleMessages("landing");
    const { locale } = useLocale();
    const query = params.get("q") ?? "";
    const topic = readArticleTopic(params.get("chu-de"));
    const sort = readArticleSort(params.get("sort"));
    const [draft, setDraft] = useState(query);
    const [syncedQuery, setSyncedQuery] = useState(query);
    const searchTimer = useRef<number | null>(null);

    if (query !== syncedQuery) {
        setSyncedQuery(query);
        setDraft(query);
    }

    useEffect(() => {
        return () => {
            if (searchTimer.current !== null) {
                window.clearTimeout(searchTimer.current);
            }
        };
    }, []);

    function text(path: string[]): string {
        return getLocaleValue(landing, path);
    }

    function commit(patch: Record<string, string | null>, resetPage = true): void {
        const next = new URLSearchParams(params.toString());

        for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === "") {
                next.delete(key);
            } else {
                next.set(key, value);
            }
        }

        if (resetPage) {
            next.delete("page");
        }

        const queryString = next.toString();
        router.replace(queryString ? `/bai-viet?${queryString}` : "/bai-viet", {
            scroll: false,
        });
    }

    function onSearch(value: string): void {
        setDraft(value);

        if (searchTimer.current !== null) {
            window.clearTimeout(searchTimer.current);
        }

        searchTimer.current = window.setTimeout(() => {
            commit({ q: value.trim() || null });
        }, 250);
    }

    const items: ArticleSearchItem[] = ARTICLES.map((article) => ({
        ...article,
        title: text(["articles", "items", article.slug, "title"]),
        lede: text(["articles", "items", article.slug, "lede"]),
        topicLabel: text(["articles", "topics", article.topic]),
    }));
    const results = filterArticles(items, query, topic, sort, locale);
    const totalPages = Math.ceil(results.length / ARTICLE_PAGE_SIZE);
    const currentPage =
        totalPages === 0 ? 1 : Math.min(readArticlePage(params.get("page")), totalPages);
    const pageItems = results.slice(
        (currentPage - 1) * ARTICLE_PAGE_SIZE,
        currentPage * ARTICLE_PAGE_SIZE,
    );
    const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });

    return (
        <div className="box-border px-4 py-8 sm:px-8 xl:px-50">
            <header className="max-w-3xl">
                <h1 className="m-0 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                    {text(["articles", "title"])}
                </h1>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-charcoal/75">
                    {text(["articles", "lede"])}
                </p>
            </header>
            <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                    <label htmlFor="tim-bai-viet" className="mb-1 block text-sm font-medium">
                        {text(["articles", "searchLabel"])}
                    </label>
                    <input
                        id="tim-bai-viet"
                        type="search"
                        value={draft}
                        placeholder={text(["articles", "searchPlaceholder"])}
                        autoComplete="off"
                        className={FIELD_CLASS}
                        onChange={(event) => onSearch(event.target.value)}
                    />
                </div>
                <div className="lg:w-56">
                    <label htmlFor="sap-xep-bai" className="mb-1 block text-sm font-medium">
                        {text(["articles", "sortLabel"])}
                    </label>
                    <select
                        id="sap-xep-bai"
                        value={sort}
                        className={FIELD_CLASS}
                        onChange={(event) =>
                            commit({
                                sort: event.target.value === "moi" ? null : event.target.value,
                            })
                        }
                    >
                        {ARTICLE_SORTS.map((key) => (
                            <option key={key} value={key}>
                                {text(["articles", "sort", key])}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div
                className="mt-4 flex flex-wrap gap-2"
                role="radiogroup"
                aria-label={text(["articles", "topicLabel"])}
            >
                <button
                    type="button"
                    role="radio"
                    aria-checked={topic === ""}
                    className={topic === "" ? `${CHIP_CLASS} border-green bg-green text-cream` : CHIP_CLASS}
                    onClick={() => commit({ "chu-de": null })}
                >
                    {text(["articles", "topicAll"])}
                </button>
                {ARTICLE_TOPICS.map((key) => {
                    const selected = topic === key;

                    return (
                        <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={
                                selected
                                    ? `${CHIP_CLASS} border-green bg-green text-cream`
                                    : CHIP_CLASS
                            }
                            onClick={() => commit({ "chu-de": key })}
                        >
                            {text(["articles", "topics", key])}
                        </button>
                    );
                })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <p className="m-0 text-sm text-charcoal/75">
                    {text(["articles", "count"]).replace("{count}", String(results.length))}
                </p>
                {query ? (
                    <button type="button" className={CHIP_CLASS} onClick={() => commit({ q: null })}>
                        {query}
                        <X size={16} aria-hidden="true" />
                        <span className="sr-only">{text(["articles", "clearSearch"])}</span>
                    </button>
                ) : null}
                {topic ? (
                    <button
                        type="button"
                        className={CHIP_CLASS}
                        onClick={() => commit({ "chu-de": null })}
                    >
                        {text(["articles", "topics", topic])}
                        <X size={16} aria-hidden="true" />
                        <span className="sr-only">{text(["articles", "clearTopic"])}</span>
                    </button>
                ) : null}
                {query || topic ? (
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        onClick={() => commit({ q: null, "chu-de": null })}
                    >
                        {text(["articles", "reset"])}
                    </button>
                ) : null}
            </div>
            {pageItems.length === 0 ? (
                <p className="mt-8 max-w-xl text-base leading-relaxed" role="status">
                    {text(["articles", "empty"])}
                </p>
            ) : (
                <ul className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
                    {pageItems.map((article, index) => (
                        <li key={article.slug}>
                            <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal/15 bg-white">
                                <Image
                                    src={article.image}
                                    alt={text(["articles", "imageAlt"])}
                                    width={640}
                                    height={360}
                                    className="aspect-video w-full object-cover"
                                    priority={index === 0}
                                />
                                <div className="flex flex-1 flex-col gap-2 p-4">
                                    <p className="m-0 text-sm text-charcoal/75">
                                        <span>{article.topicLabel}</span>
                                        <span aria-hidden="true"> · </span>
                                        <time dateTime={article.publishedAt}>
                                            {dateFormat.format(new Date(`${article.publishedAt}T00:00:00Z`))}
                                        </time>
                                    </p>
                                    <h2 className="m-0 text-lg leading-snug font-semibold">
                                        {article.title}
                                    </h2>
                                    <p className="m-0 text-sm leading-relaxed text-charcoal/80">
                                        {article.lede}
                                    </p>
                                </div>
                            </article>
                        </li>
                    ))}
                </ul>
            )}
            {totalPages > 1 ? (
                <div className="mt-8">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={(page) =>
                            commit({ page: page === 1 ? null : String(page) }, false)
                        }
                        labels={{
                            nav: text(["catalog", "pagination"]),
                            previous: text(["catalog", "pagePrevious"]),
                            next: text(["catalog", "pageNext"]),
                            first: text(["catalog", "pageFirst"]),
                            last: text(["catalog", "pageLast"]),
                            page: text(["catalog", "page"]),
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}
