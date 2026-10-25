"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { legalDocumentPath } from "@/features/legal/legal-documents";
import {
    filterLegalDocuments,
    readLegalSort,
    LEGAL_SORTS,
    type LegalSearchItem,
    type LegalSort,
} from "@/features/legal/legal-search";

const FIELD_CLASS =
    "box-border min-h-11 w-full rounded-full border border-charcoal/20 bg-white px-4 text-sm text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

export default function LegalIndex({
    title,
    lede,
    items,
    locale,
    labels,
}: {
    title: string;
    lede: string;
    items: LegalSearchItem[];
    locale: string;
    labels: {
        searchLabel: string;
        searchPlaceholder: string;
        sortLabel: string;
        sorts: Record<LegalSort, string>;
        resultUnit: string;
        empty: string;
        clear: string;
        publicLabel: string;
        internalLabel: string;
    };
}) {
    const router = useRouter();
    const params = useSearchParams();
    const query = params.get("q") ?? "";
    const sort = readLegalSort(params.get("sort"));
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

    function commit(patch: Record<string, string | null>): void {
        const next = new URLSearchParams(params.toString());

        for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === "") {
                next.delete(key);
            } else {
                next.set(key, value);
            }
        }

        const queryString = next.toString();
        router.replace(queryString ? `/phap-ly?${queryString}` : "/phap-ly", {
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

    const results = filterLegalDocuments(items, query, sort, locale);

    return (
        <div className="box-border px-4 py-12 sm:px-8 xl:px-50">
            <header className="max-w-3xl">
                <h1 className="m-0 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                    {title}
                </h1>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-charcoal/75">
                    {lede}
                </p>
            </header>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <label htmlFor="tim-phap-ly" className="mb-1 block text-sm font-medium">
                        {labels.searchLabel}
                    </label>
                    <input
                        id="tim-phap-ly"
                        type="search"
                        value={draft}
                        placeholder={labels.searchPlaceholder}
                        autoComplete="off"
                        className={FIELD_CLASS}
                        onChange={(event) => onSearch(event.target.value)}
                    />
                </div>
                <div className="sm:w-56">
                    <label htmlFor="sap-xep-phap-ly" className="mb-1 block text-sm font-medium">
                        {labels.sortLabel}
                    </label>
                    <select
                        id="sap-xep-phap-ly"
                        value={sort}
                        className={FIELD_CLASS}
                        onChange={(event) =>
                            commit({
                                sort:
                                    event.target.value === "relevance"
                                        ? null
                                        : event.target.value,
                            })
                        }
                    >
                        {LEGAL_SORTS.map((key) => (
                            <option key={key} value={key}>
                                {labels.sorts[key]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <p className="mt-6 mb-0 text-sm tabular-nums" aria-live="polite">
                {results.length} {labels.resultUnit}
            </p>
            {results.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-charcoal/25 px-6 py-10">
                    <p className="m-0 text-base">{labels.empty}</p>
                    <button
                        type="button"
                        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-green px-5 text-cream"
                        onClick={() => {
                            setDraft("");
                            commit({ q: null });
                        }}
                    >
                        {labels.clear}
                    </button>
                </div>
            ) : (
                <ul className="m-0 mt-4 list-none border-t border-charcoal/15 p-0">
                    {results.map((item) => (
                        <li key={item.slug} className="border-b border-charcoal/15">
                            <Link
                                href={legalDocumentPath(item.slug)}
                                className="flex min-h-11 flex-col gap-1 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                            >
                                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="text-base font-semibold">{item.title}</span>
                                    <span className="text-sm text-charcoal/60">
                                        {item.indexable
                                            ? labels.publicLabel
                                            : labels.internalLabel}
                                    </span>
                                </span>
                                <span className="max-w-prose text-sm leading-relaxed text-charcoal/75">
                                    {item.description}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
