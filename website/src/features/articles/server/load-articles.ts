import "server-only";

import {
    readArticlePage,
    readArticleSort,
    readArticleTopic,
    type PublicArticle,
    type PublishedList,
} from "@/features/articles/articles";

export type PublishedArticle = PublicArticle & {
    body: string;
    updatedAt: string;
    author: { name: string; username: string | null; avatarUrl: string | null };
    stats: { upvotes: number; downvotes: number; comments: number };
};

type Envelope<T> = {
    success?: boolean;
    data?: T;
    message?: string;
};

function apiOrigin(): string {
    const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
    if (target) return target;
    const port = process.env.BACKEND_PORT || "22370";
    return `http://127.0.0.1:${port}`;
}

function apiUrl(path: string): string {
    const prefix = (process.env.GLOBAL_PREFIX || "api/v1").replace(/^\/|\/$/g, "");
    return `${apiOrigin()}/${prefix}${path}`;
}

async function readJson<T>(path: string): Promise<T | null> {
    const response = await fetch(
        apiUrl(path),
        process.env.NODE_ENV === "production" ? { next: { revalidate: 60 } } : { cache: "no-store" },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("request failed");
    const body = (await response.json()) as Envelope<T>;
    return body.data ?? null;
}

export async function loadPublishedArticles(input: {
    q: string;
    topic: string;
    sort: string;
    page: string;
}): Promise<PublishedList> {
    const topic = readArticleTopic(input.topic);
    const sort = readArticleSort(input.sort);
    const page = readArticlePage(input.page);
    const params = new URLSearchParams();
    if (input.q.trim()) params.set("q", input.q.trim());
    if (topic) params.set("topic", topic);
    if (sort !== "moi") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));

    try {
        const data = await readJson<Omit<PublishedList, "error">>(`/articles?${params.toString()}`);
        if (!data) {
            return { items: [], page: 1, pageSize: 6, total: 0, error: "Chưa tải được bài viết." };
        }
        return { ...data, error: null };
    } catch {
        return { items: [], page: 1, pageSize: 6, total: 0, error: "Chưa tải được bài viết." };
    }
}

export async function loadPublishedArticle(slug: string): Promise<PublishedArticle | null> {
    try {
        return await readJson<PublishedArticle>(`/articles/${encodeURIComponent(slug)}`);
    } catch {
        return null;
    }
}

export async function loadRelatedArticles(slug: string): Promise<PublicArticle[]> {
    try {
        return (await readJson<PublicArticle[]>(`/articles/${encodeURIComponent(slug)}/related`)) ?? [];
    } catch {
        return [];
    }
}
