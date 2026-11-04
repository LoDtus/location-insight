"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";

import { buildCrumbs } from "@/features/app/breadcrumbs";
import { useLocale } from "@/shared/hooks/useLocale";

/** Đường dẫn A > B > C ở đầu nội dung của các tab có trang con. */
export default function AppBreadcrumbs(): JSX.Element | null {
    const pathname = usePathname();
    const { locale } = useLocale();
    const crumbs = buildCrumbs(pathname, locale === "vi");
    if (!crumbs) return null;
    return (
        <nav aria-label={locale === "vi" ? "Đường dẫn" : "Breadcrumb"} className="shrink-0 bg-white px-4 pt-4 sm:px-6">
            <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 p-0 text-sm text-charcoal/70">
                {crumbs.map((crumb, index) => (
                    <li key={`${index}-${crumb.label}`} className="inline-flex items-center gap-x-2">
                        {index > 0 ? <span aria-hidden="true">›</span> : null}
                        {crumb.href ? (
                            <Link href={crumb.href} className="inline-flex min-h-8 items-center font-semibold text-green no-underline hover:underline">
                                {crumb.label}
                            </Link>
                        ) : (
                            <span aria-current="page" className="inline-flex min-h-8 items-center text-charcoal">
                                {crumb.label}
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
