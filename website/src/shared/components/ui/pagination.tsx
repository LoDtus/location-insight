"use client";

import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react";

export interface PaginationLabels {
    nav: string;
    previous: string;
    next: string;
    first: string;
    last: string;
    page: string;
}

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    labels: PaginationLabels;
    mode?: "long" | "short";
}

const CONTROL_CLASS =
    "inline-flex size-11 items-center justify-center rounded-full border border-charcoal/20 bg-white text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

const ACTIVE_CLASS =
    "inline-flex size-11 items-center justify-center rounded-full border border-green bg-green text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

function pageLabel(template: string, page: number): string {
    return template.replace("{page}", String(page));
}

function getShortPages(currentPage: number, totalPages: number): number[] {
    if (totalPages <= 4) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 3) {
        return [1, 2, 3, 4];
    }

    if (currentPage >= totalPages - 2) {
        return [totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [currentPage - 1, currentPage, currentPage + 1];
}

function getLongPages(currentPage: number, totalPages: number): (number | "...")[] {
    if (totalPages <= 10) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const startPages = [1, 2];
    const endPages = [totalPages - 1, totalPages];

    if (currentPage <= 5) {
        return [1, 2, 3, 4, 5, 6, "...", ...endPages];
    }

    if (currentPage >= totalPages - 4) {
        const lastSixPages: number[] = [];

        for (let page = totalPages - 5; page <= totalPages; page += 1) {
            lastSixPages.push(page);
        }

        return [...startPages, "...", ...lastSixPages];
    }

    return [
        ...startPages,
        "...",
        currentPage - 2,
        currentPage - 1,
        currentPage,
        currentPage + 1,
        currentPage + 2,
        "...",
        ...endPages,
    ];
}

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    labels,
    mode = "long",
}: PaginationProps) {
    if (totalPages <= 1) {
        return null;
    }

    if (mode === "short") {
        const visiblePages = getShortPages(currentPage, totalPages);
        const showFirst = totalPages > 4 && currentPage > 3;
        const showLast = totalPages > 4 && currentPage < totalPages - 2;

        return (
            <nav aria-label={labels.nav} className="flex flex-wrap items-center justify-center gap-2">
                {showFirst ? (
                    <button
                        type="button"
                        className={CONTROL_CLASS}
                        aria-label={labels.first}
                        onClick={() => onPageChange(1)}
                    >
                        <ChevronsLeft size={18} aria-hidden="true" />
                    </button>
                ) : null}
                {visiblePages.map((page) => (
                    <PageButton
                        key={page}
                        page={page}
                        currentPage={currentPage}
                        label={pageLabel(labels.page, page)}
                        onPageChange={onPageChange}
                    />
                ))}
                {showLast ? (
                    <button
                        type="button"
                        className={CONTROL_CLASS}
                        aria-label={labels.last}
                        onClick={() => onPageChange(totalPages)}
                    >
                        <ChevronsRight size={18} aria-hidden="true" />
                    </button>
                ) : null}
            </nav>
        );
    }

    const longPages = getLongPages(currentPage, totalPages);

    return (
        <nav aria-label={labels.nav} className="flex flex-wrap items-center justify-center gap-2">
            {currentPage > 1 ? (
                <button
                    type="button"
                    className={CONTROL_CLASS}
                    aria-label={labels.previous}
                    onClick={() => onPageChange(currentPage - 1)}
                >
                    <ChevronLeft size={18} aria-hidden="true" />
                </button>
            ) : null}
            {longPages.map((item, index) => {
                if (item === "...") {
                    return (
                        <span key={`ellipsis-${index}`} aria-hidden="true" className="px-1 text-charcoal/70">
                            …
                        </span>
                    );
                }

                return (
                    <PageButton
                        key={item}
                        page={item}
                        currentPage={currentPage}
                        label={pageLabel(labels.page, item)}
                        onPageChange={onPageChange}
                    />
                );
            })}
            {currentPage < totalPages ? (
                <button
                    type="button"
                    className={CONTROL_CLASS}
                    aria-label={labels.next}
                    onClick={() => onPageChange(currentPage + 1)}
                >
                    <ChevronRight size={18} aria-hidden="true" />
                </button>
            ) : null}
        </nav>
    );
}

function PageButton({
    page,
    currentPage,
    label,
    onPageChange,
}: {
    page: number;
    currentPage: number;
    label: string;
    onPageChange: (page: number) => void;
}) {
    const isCurrent = page === currentPage;

    return (
        <button
            type="button"
            className={isCurrent ? ACTIVE_CLASS : CONTROL_CLASS}
            aria-label={label}
            aria-current={isCurrent ? "page" : undefined}
            onClick={() => {
                if (!isCurrent) {
                    onPageChange(page);
                }
            }}
        >
            {page}
        </button>
    );
}
