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
    /** standard | photo | video (bài cũ trước khi có cột có thể thiếu). */
    format?: ArticleFormat;
    /** Liên kết nhúng đã được máy chủ kiểm tra (youtube-nocookie / player.vimeo). */
    videoEmbed?: string | null;
};

export const ARTICLE_FORMATS = ["standard", "photo", "video"] as const;
export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

/** Thẻ bài trên trang /bai-viet, kèm số liệu hiển thị. */
export type ArticleCard = PublicArticle & {
    publishedAt: string;
    format: ArticleFormat;
    videoEmbed: string | null;
    views: number;
    comments: number;
    upvotes: number;
    /** Thời gian đọc ước tính, phút (bài cũ trong bộ đệm có thể thiếu). */
    readingMinutes?: number;
};

/** Các mục phân trang của /bai-viet (GET /articles/home/sections/:section?page=). */
export const HOME_SECTIONS = ["latest", "popular", "engaged", "media"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

export type SectionPage = { items: ArticleCard[]; page: number; pageSize: number; total: number };

/** Dữ liệu trang /bai-viet (GET /articles/home). */
export type ArticleHome = {
    lead: ArticleCard | null;
    secondary: ArticleCard[];
    latest: ArticleCard[];
    popular: ArticleCard[];
    popularWindow: "7d" | "30d" | "all";
    engaged: ArticleCard[];
    recommended: ArticleCard[];
    media: ArticleCard[];
    /** Tổng số bài và cỡ trang của từng mục phân trang. */
    paging?: Record<HomeSection, { total: number; pageSize: number }>;
    topics: { topic: string; items: ArticleCard[] }[];
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
