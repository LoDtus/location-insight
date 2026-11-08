"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import type { JSX } from "react";

import { pageWindow } from "@/features/articles/front-sections";
import type { PagedSection } from "./use-paged-section";

type Text = (path: string[]) => string;

function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/**
 * Thanh phân trang của một mục: Trước / số trang (có lược "…") / Sau. Màn hẹp chỉ còn Trước, "2/6", Sau.
 * Trang hiện tại có aria-current; trạng thái tải và lỗi được đọc qua vùng aria-live.
 */
export default function SectionPager({ name, paged, text, dark = false }: { name: string; paged: PagedSection; text: Text; dark?: boolean }): JSX.Element | null {
    if (paged.pages <= 1) return null;
    const t = (key: string): string => text(["articles", "front", key]);
    const tone = dark
        ? "border-cream/25 text-cream hover:bg-cream/10 aria-[current=page]:bg-cream aria-[current=page]:text-charcoal aria-[current=page]:border-cream focus-visible:outline-cream"
        : "border-charcoal/15 text-charcoal hover:bg-charcoal/5 aria-[current=page]:bg-charcoal aria-[current=page]:text-white aria-[current=page]:border-charcoal focus-visible:outline-green";
    const cell = `inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-full border px-3 font-sans text-sm font-semibold tabular-nums disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 ${tone}`;
    const status = paged.loading !== null ? fill(t("pageLoading"), { page: paged.loading }) : paged.error ? t("loadError") : fill(t("pageOf"), { page: paged.page, pages: paged.pages });

    return (
        <nav aria-label={fill(t("pagination"), { name })} className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className={`m-0 inline-flex items-center gap-2 font-sans text-sm ${dark ? "text-cream/70" : "text-charcoal/60"}`}>
                {paged.loading !== null ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
                {status}
                {paged.error && paged.loading === null ? (
                    <button type="button" onClick={() => paged.goTo(paged.page)} className={`font-semibold underline underline-offset-2 ${dark ? "text-cream" : "text-green"}`}>
                        {t("retry")}
                    </button>
                ) : null}
            </p>
            <ul className="m-0 flex list-none items-center gap-1.5 p-0">
                <li>
                    <button
                        type="button"
                        className={cell}
                        disabled={paged.page <= 1}
                        onClick={() => paged.goTo(paged.page - 1)}
                        onPointerEnter={() => paged.prefetch(paged.page - 1)}
                        aria-label={t("pagePrev")}
                    >
                        <ChevronLeft size={16} aria-hidden />
                    </button>
                </li>
                {pageWindow(paged.page, paged.pages).map((value, index) =>
                    value === "gap" ? (
                        <li key={`gap-${index}`} aria-hidden className={`hidden px-1 sm:block ${dark ? "text-cream/50" : "text-charcoal/40"}`}>
                            …
                        </li>
                    ) : (
                        <li key={value} className="hidden sm:block">
                            <button
                                type="button"
                                className={cell}
                                aria-current={value === paged.page ? "page" : undefined}
                                aria-label={fill(t("pageGo"), { page: value })}
                                onClick={() => (value === paged.page ? undefined : paged.goTo(value))}
                                onPointerEnter={() => paged.prefetch(value)}
                            >
                                {value}
                            </button>
                        </li>
                    ),
                )}
                <li>
                    <button
                        type="button"
                        className={cell}
                        disabled={paged.page >= paged.pages}
                        onClick={() => paged.goTo(paged.page + 1)}
                        onPointerEnter={() => paged.prefetch(paged.page + 1)}
                        aria-label={t("pageNext")}
                    >
                        <ChevronRight size={16} aria-hidden />
                    </button>
                </li>
            </ul>
        </nav>
    );
}
