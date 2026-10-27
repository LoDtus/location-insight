export const ARTICLE_TOPICS = ["cach-doc", "khu-vuc", "gia", "du-lieu"] as const;

export const ARTICLE_SORTS = ["moi", "cu", "ten"] as const;

export const ARTICLE_PAGE_SIZE = 6;

export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];
export type ArticleSort = (typeof ARTICLE_SORTS)[number];

export type PublicArticle = {
    slug: string;
    title: string;
    lede: string;
    topic: string;
    publishedAt: string | null;
    coverImage: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
};

export type PublishedList = {
    items: PublicArticle[];
    page: number;
    pageSize: number;
    total: number;
    error: string | null;
};

export function readArticleTopic(value: string | null): ArticleTopic | "" {
    if (value && (ARTICLE_TOPICS as readonly string[]).includes(value)) {
        return value as ArticleTopic;
    }

    return "";
}

export function readArticleSort(value: string | null): ArticleSort {
    if (value && (ARTICLE_SORTS as readonly string[]).includes(value)) {
        return value as ArticleSort;
    }

    return "moi";
}

export function readArticlePage(value: string | null): number {
    const page = Number(value);

    if (!Number.isInteger(page) || page < 1) {
        return 1;
    }

    return page;
}
