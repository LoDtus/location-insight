import Image from "next/image";
import Link from "next/link";
import type { JSX } from "react";

import { articleCoverSrc, isVectorCover } from "@/features/articles/article-cover";
import type { PublicArticle } from "@/features/articles/articles";

/** Ảnh nhỏ của bài; bài chưa có ảnh bìa dùng minh họa của chủ đề. */
function Thumb({ item, className }: { item: PublicArticle; className: string }): JSX.Element {
    const src = articleCoverSrc(item);
    return <Image src={src} alt="" width={300} height={180} unoptimized={isVectorCover(src)} className={`shrink-0 bg-charcoal/[0.06] object-cover ${className}`} />;
}

/**
 * Bài liên quan, hai kiểu theo báo điện tử:
 * - "rail": cột phải kiểu "Xem nhiều" của VnExpress (tiêu đề có gạch nhấn, ảnh nhỏ 110×66 + tiêu đề, kẻ ngăn giữa các mục).
 * - "box": khung "tin liên quan" ngay sau thân bài (ảnh lớn hơn + tiêu đề + đoạn dẫn).
 */
export default function ArticleRelated({
    items,
    title,
    topics,
    locale,
    variant = "rail",
}: {
    items: PublicArticle[];
    title: string;
    topics: Record<string, string>;
    locale: string;
    variant?: "rail" | "box";
}): JSX.Element | null {
    if (items.length === 0) return null;
    const format = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
    const meta = (item: PublicArticle): string =>
        `${topics[item.topic] ?? item.topic}${item.publishedAt ? ` · ${format.format(new Date(item.publishedAt))}` : ""}`;

    if (variant === "box") {
        return (
            <aside aria-label={title} className="border border-charcoal/15 px-4">
                <ul className="m-0 list-none divide-y divide-charcoal/15 p-0">
                    {items.map((item) => (
                        <li key={item.slug} className="py-4">
                            <Link
                                href={`/bai-viet/${item.slug}`}
                                className="group flex gap-4 text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                            >
                                <Thumb item={item} className="aspect-[5/3] w-28 sm:w-[150px]" />
                                <span className="min-w-0">
                                    <span className="block font-serif text-[15px] leading-6 font-bold group-hover:text-green sm:text-base">{item.title}</span>
                                    <span className="mt-1 line-clamp-2 block font-sans text-sm leading-[1.6] text-charcoal/75 max-sm:hidden">{item.lede}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </aside>
        );
    }

    return (
        <aside aria-label={title}>
            <h2 className="m-0 mb-3 font-serif text-lg leading-7 font-bold">
                <span className="inline-block border-b-2 border-green pb-1">{title}</span>
            </h2>
            <ul className="m-0 list-none divide-y divide-charcoal/15 border-t border-charcoal/15 p-0">
                {items.map((item) => (
                    <li key={item.slug} className="py-3">
                        <Link
                            href={`/bai-viet/${item.slug}`}
                            className="group flex gap-3 text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        >
                            <Thumb item={item} className="h-[66px] w-[110px]" />
                            <span className="min-w-0">
                                <span className="line-clamp-3 block font-serif text-[15px] leading-6 font-bold group-hover:text-green">{item.title}</span>
                                <span className="mt-0.5 block font-sans text-xs text-charcoal/60">{meta(item)}</span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
