import Image from "next/image";
import Link from "next/link";
import type { JSX } from "react";

import type { PublicArticle } from "@/features/articles/articles";

/** Bài liên quan bên phải; cột cha dán (sticky) để luôn thấy khi cuộn. */
export default function ArticleRelated({
    items,
    title,
    topics,
    locale,
}: {
    items: PublicArticle[];
    title: string;
    topics: Record<string, string>;
    locale: string;
}): JSX.Element | null {
    if (items.length === 0) return null;
    const format = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    return (
        <aside aria-label={title}>
            <h2 className="m-0 mb-3 text-xs font-semibold tracking-wide text-charcoal/60 uppercase">{title}</h2>
            <ul className="m-0 grid list-none gap-3 p-0">
                {items.map((item) => (
                    <li key={item.slug}>
                        <Link href={`/bai-viet/${item.slug}`} className="group flex gap-3 rounded-xl p-1.5 text-inherit no-underline hover:bg-white focus-visible:outline-2 focus-visible:outline-green">
                            {item.coverImage?.startsWith("/") ? (
                                <Image src={item.coverImage} alt="" width={96} height={64} className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                            ) : (
                                <span aria-hidden className="h-16 w-24 shrink-0 rounded-lg bg-charcoal/10" />
                            )}
                            <span className="min-w-0">
                                <span className="block text-xs text-charcoal/65">
                                    {topics[item.topic] ?? item.topic}
                                    {item.publishedAt ? ` · ${format.format(new Date(item.publishedAt))}` : ""}
                                </span>
                                <span className="mt-0.5 line-clamp-3 block text-sm leading-snug font-semibold group-hover:underline">{item.title}</span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
