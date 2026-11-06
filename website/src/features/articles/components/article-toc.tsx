"use client";

import { useEffect, useState, type JSX } from "react";

import type { RichTextHeading } from "@/shared/components/editor/rich-text-markdown";

/**
 * Mục lục bài: bám theo tiêu đề đang đọc, nhảy tới tiêu đề khi bấm.
 * `collapsible`: dạng gập (màn hẹp, đặt dưới sapo); mặc định là khung ở cột phải.
 */
export default function ArticleToc({
    headings,
    title,
    collapsible = false,
}: {
    headings: RichTextHeading[];
    title: string;
    collapsible?: boolean;
}): JSX.Element | null {
    const [active, setActive] = useState(headings[0]?.id ?? "");

    useEffect(() => {
        const nodes = headings.map((heading) => document.getElementById(heading.id)).filter((node): node is HTMLElement => node !== null);
        if (nodes.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (visible) setActive(visible.target.id);
            },
            { rootMargin: "-10% 0px -70% 0px" },
        );
        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [headings]);

    if (headings.length === 0) return null;
    const list = (
        <ol className="m-0 grid list-none gap-0.5 border-l border-charcoal/15 p-0 font-sans">
            {headings.map((heading) => (
                <li key={heading.id}>
                    <a
                        href={`#${heading.id}`}
                        aria-current={active === heading.id ? "location" : undefined}
                        className={`-ml-px block border-l-2 py-1.5 text-sm leading-snug no-underline focus-visible:outline-2 focus-visible:outline-green ${heading.level === 3 ? "pl-6" : "pl-3"} ${active === heading.id ? "border-green font-semibold text-green" : "border-transparent text-charcoal/75 hover:text-charcoal"}`}
                    >
                        {heading.text}
                    </a>
                </li>
            ))}
        </ol>
    );
    if (collapsible) {
        return (
            <nav aria-label={title}>
                <details className="group border border-charcoal/15 bg-charcoal/[0.03] px-4 py-3">
                    <summary className="cursor-pointer list-none font-serif text-base font-bold marker:content-none">
                        <span className="flex items-center justify-between gap-3">
                            {title}
                            <span aria-hidden className="font-sans text-sm text-charcoal/60 transition-transform group-open:rotate-180">
                                ▾
                            </span>
                        </span>
                    </summary>
                    <div className="mt-3">{list}</div>
                </details>
            </nav>
        );
    }
    return (
        <nav aria-label={title}>
            <p className="m-0 mb-3 font-serif text-lg leading-7 font-bold">
                <span className="inline-block border-b-2 border-green pb-1">{title}</span>
            </p>
            {list}
        </nav>
    );
}
