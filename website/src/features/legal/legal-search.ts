import type { LegalSlug } from "@/features/legal/legal-documents";

export const LEGAL_SORTS = ["relevance", "title-asc", "title-desc"] as const;

export type LegalSort = (typeof LEGAL_SORTS)[number];

export type LegalSearchItem = {
    slug: LegalSlug;
    title: string;
    description: string;
    indexable: boolean;
    order: number;
};

const TITLE_PHRASE = 50;
const TITLE_START = 70;
const TITLE_EXACT = 100;
const TITLE_TOKEN = 28;
const TITLE_PREFIX = 18;
const TITLE_TYPO = 14;
const DESCRIPTION_PHRASE = 24;
const DESCRIPTION_TOKEN = 10;
const SLUG_TOKEN = 6;

function fold(value: string): string {
    return value
        .replace(/[đĐ]/g, "d")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
}

function tokens(value: string): string[] {
    return fold(value)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 0);
}

function editDistance(left: string, right: string): number {
    if (Math.abs(left.length - right.length) > 1) {
        return 2;
    }

    const rows = left.length + 1;
    const cols = right.length + 1;
    const grid = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

    for (let row = 0; row < rows; row += 1) {
        grid[row][0] = row;
    }

    for (let col = 0; col < cols; col += 1) {
        grid[0][col] = col;
    }

    for (let row = 1; row < rows; row += 1) {
        let rowBest = row;

        for (let col = 1; col < cols; col += 1) {
            const cost = left[row - 1] === right[col - 1] ? 0 : 1;
            grid[row][col] = Math.min(
                grid[row - 1][col] + 1,
                grid[row][col - 1] + 1,
                grid[row - 1][col - 1] + cost,
            );
            rowBest = Math.min(rowBest, grid[row][col]);
        }

        if (rowBest > 1) {
            return 2;
        }
    }

    return grid[left.length][right.length];
}

function tokenScore(token: string, title: string, titleWords: string[], description: string, slug: string): number {
    if (title.includes(token)) {
        return TITLE_TOKEN;
    }

    if (token.length >= 2 && titleWords.some((word) => word.startsWith(token))) {
        return TITLE_PREFIX;
    }

    if (token.length >= 4 && titleWords.some((word) => editDistance(word, token) === 1)) {
        return TITLE_TYPO;
    }

    if (description.includes(token)) {
        return DESCRIPTION_TOKEN;
    }

    if (slug.includes(token)) {
        return SLUG_TOKEN;
    }

    return 0;
}

export function scoreLegalDocument(item: LegalSearchItem, query: string): number {
    const needle = fold(query.trim());

    if (!needle) {
        return 0;
    }

    const title = fold(item.title);
    const description = fold(item.description);
    const slug = fold(item.slug.replaceAll("-", " "));
    const titleWords = tokens(item.title);
    const queryTokens = tokens(needle);
    let score = 0;

    if (title === needle) {
        score += TITLE_EXACT;
    } else if (title.startsWith(needle)) {
        score += TITLE_START;
    } else if (title.includes(needle)) {
        score += TITLE_PHRASE;
    }

    if (description.includes(needle)) {
        score += DESCRIPTION_PHRASE;
    }

    for (const token of queryTokens) {
        const weight = tokenScore(token, title, titleWords, description, slug);

        if (weight === 0) {
            return 0;
        }

        score += weight;
    }

    return score;
}

export function readLegalSort(value: string | null): LegalSort {
    if (value === "title-asc" || value === "title-desc") {
        return value;
    }

    return "relevance";
}

export function filterLegalDocuments(
    items: LegalSearchItem[],
    query: string,
    sort: LegalSort,
    locale: string,
): LegalSearchItem[] {
    const needle = query.trim();
    const ranked = items
        .map((item) => ({
            item,
            score: needle ? scoreLegalDocument(item, needle) : 0,
        }))
        .filter((entry) => !needle || entry.score > 0);

    ranked.sort((left, right) => {
        if (sort === "title-asc" || sort === "title-desc") {
            const byTitle = left.item.title.localeCompare(right.item.title, locale, {
                sensitivity: "base",
            });

            return sort === "title-asc" ? byTitle : -byTitle;
        }

        if (needle && right.score !== left.score) {
            return right.score - left.score;
        }

        return left.item.order - right.item.order;
    });

    return ranked.map((entry) => entry.item);
}
