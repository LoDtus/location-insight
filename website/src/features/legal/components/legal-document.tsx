import Link from "next/link";
import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import {
    LEGAL_PATH_PREFIX,
    legalDocumentPath,
    type LegalSlug,
} from "@/features/legal/legal-documents";
import { extractToc, slugifyHeading } from "@/features/legal/legal-toc";

const LINK_CLASS =
    "text-charcoal/80 underline-offset-4 hover:text-charcoal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

function textOf(children: ReactNode): string {
    return Children.toArray(children)
        .filter(
            (child) => typeof child === "string" || typeof child === "number",
        )
        .join("");
}

export default function LegalDocument({
    title,
    markdown,
    labels,
    documents,
    currentSlug,
}: {
    title: string;
    markdown: string;
    labels: {
        toc: string;
        tocOpen: string;
        backToList: string;
        documents: string;
    };
    documents: Array<{ slug: LegalSlug; title: string }>;
    currentSlug: LegalSlug;
}) {
    const body = markdown.trim();
    const toc = extractToc(body);
    const tocList = (
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-sm leading-snug">
            {toc.map((item) => (
                <li key={item.id}>
                    <a
                        href={`#${item.id}`}
                        className={`${LINK_CLASS} block py-1`}
                    >
                        {item.text}
                    </a>
                </li>
            ))}
        </ol>
    );
    const documentList = (
        <nav aria-label={labels.documents}>
            <p className="m-0 mb-2 text-sm font-semibold">{labels.documents}</p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm leading-snug">
                {documents.map((item) => (
                    <li key={item.slug}>
                        <Link
                            href={legalDocumentPath(item.slug)}
                            aria-current={
                                item.slug === currentSlug ? "page" : undefined
                            }
                            className={`${LINK_CLASS} block py-1 aria-[current=page]:font-semibold aria-[current=page]:text-charcoal`}
                        >
                            {item.title}
                        </Link>
                    </li>
                ))}
            </ul>
            <Link
                href={LEGAL_PATH_PREFIX}
                className={`${LINK_CLASS} mt-3 inline-block text-sm`}
            >
                {labels.backToList}
            </Link>
        </nav>
    );

    return (
        <div className="box-border px-4 py-12 sm:px-8">
            <div className="mx-auto grid w-full max-w-6xl gap-8 xl:grid-cols-[13rem_minmax(0,1fr)_15rem] xl:gap-10">
                {toc.length > 0 ? (
                    <aside className="xl:sticky xl:top-6 xl:self-start">
                        <details className="rounded-lg border border-charcoal/15 px-4 py-3 xl:hidden">
                            <summary className="cursor-pointer text-sm font-semibold">
                                {labels.tocOpen}
                            </summary>
                            <nav aria-label={labels.toc} className="mt-2">
                                {tocList}
                            </nav>
                        </details>
                        <nav
                            aria-label={labels.toc}
                            className="hidden border-l border-charcoal/15 pl-4 xl:block"
                        >
                            <p className="m-0 mb-2 text-sm font-semibold">
                                {labels.toc}
                            </p>
                            {tocList}
                        </nav>
                    </aside>
                ) : (
                    <div className="hidden xl:block" aria-hidden="true" />
                )}
                <article className="min-w-0">
                    <h1 className="m-0 max-w-[30ch] text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                        {title}
                    </h1>
                    {body ? (
                        <div className="mt-8 max-w-prose text-base leading-relaxed">
                            <ReactMarkdown
                                components={{
                                    h2: ({ children }) => (
                                        <h2
                                            id={
                                                slugifyHeading(
                                                    textOf(children),
                                                ) || undefined
                                            }
                                            className="mt-8 mb-3 scroll-mt-6 text-2xl leading-snug font-semibold"
                                        >
                                            {children}
                                        </h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 className="mt-6 mb-2 text-xl leading-snug font-semibold">
                                            {children}
                                        </h3>
                                    ),
                                    p: ({ children }) => (
                                        <p className="mt-4 mb-0">{children}</p>
                                    ),
                                    ul: ({ children }) => (
                                        <ul className="mt-4 mb-0 list-disc pl-5">
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="mt-4 mb-0 list-decimal pl-5">
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ children }) => (
                                        <li className="mt-1">{children}</li>
                                    ),
                                    a: ({ href, children }) => (
                                        <a
                                            href={href}
                                            className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                        >
                                            {children}
                                        </a>
                                    ),
                                }}
                            >
                                {body}
                            </ReactMarkdown>
                        </div>
                    ) : null}
                </article>
                <aside className="border-t border-charcoal/15 pt-6 xl:sticky xl:top-6 xl:self-start xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4">
                    {documentList}
                </aside>
            </div>
        </div>
    );
}
