import {
    ARTICLES,
    ARTICLE_SORTS,
    ARTICLE_TOPICS,
    type ArticleRecord,
    type ArticleSort,
    type ArticleTopic,
} from "@/features/articles/articles";

export type ArticleSearchItem = ArticleRecord & {
    title: string;
    lede: string;
    topicLabel: string;
};

export function fold(value: string): string {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

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

export function filterArticles(
    items: readonly ArticleSearchItem[],
    query: string,
    topic: ArticleTopic | "",
    sort: ArticleSort,
    locale: string,
): ArticleSearchItem[] {
    const needle = fold(query.trim());
    const matched = items.filter((item) => {
        if (topic && item.topic !== topic) {
            return false;
        }

        if (!needle) {
            return true;
        }

        const haystack = fold(`${item.title} ${item.lede} ${item.topicLabel}`);

        return haystack.includes(needle);
    });

    return matched.sort((left, right) => compareArticles(left, right, sort, locale));
}

function compareArticles(
    left: ArticleSearchItem,
    right: ArticleSearchItem,
    sort: ArticleSort,
    locale: string,
): number {
    if (sort === "cu") {
        return left.publishedAt.localeCompare(right.publishedAt);
    }

    if (sort === "ten") {
        return left.title.localeCompare(right.title, locale);
    }

    return right.publishedAt.localeCompare(left.publishedAt);
}

export function articleBySlug(slug: string): ArticleRecord | undefined {
    return ARTICLES.find((article) => article.slug === slug);
}
