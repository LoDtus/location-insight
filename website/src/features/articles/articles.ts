export const ARTICLE_TOPICS = ["cach-doc", "khu-vuc", "gia", "du-lieu"] as const;

export const ARTICLE_SORTS = ["moi", "cu", "ten"] as const;

export const ARTICLE_PAGE_SIZE = 6;

const IMAGES = [
    "/images/temp-002.jpg",
    "/images/temp-003.jpg",
    "/images/temp-004.jpg",
] as const;

export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];
export type ArticleSort = (typeof ARTICLE_SORTS)[number];

export type ArticleRecord = {
    slug: string;
    topic: ArticleTopic;
    publishedAt: string;
    image: (typeof IMAGES)[number];
};

export const ARTICLES: readonly ArticleRecord[] = [
    { slug: "ban-kinh-500-met", topic: "cach-doc", publishedAt: "2026-10-12", image: IMAGES[0] },
    { slug: "ghim-lech", topic: "cach-doc", publishedAt: "2026-10-02", image: IMAGES[1] },
    { slug: "thieu-du-lieu", topic: "du-lieu", publishedAt: "2026-09-18", image: IMAGES[2] },
    { slug: "khong-ket-luan-ngap", topic: "du-lieu", publishedAt: "2026-09-04", image: IMAGES[0] },
    { slug: "khung-gia", topic: "gia", publishedAt: "2026-08-21", image: IMAGES[1] },
    { slug: "thieu-mat-tien", topic: "gia", publishedAt: "2026-08-07", image: IMAGES[2] },
    { slug: "ho-tay", topic: "khu-vuc", publishedAt: "2026-07-16", image: IMAGES[0] },
    { slug: "pho-co", topic: "khu-vuc", publishedAt: "2026-07-02", image: IMAGES[1] },
    { slug: "cau-giay", topic: "khu-vuc", publishedAt: "2026-06-11", image: IMAGES[2] },
    { slug: "dong-anh", topic: "khu-vuc", publishedAt: "2026-05-20", image: IMAGES[0] },
    { slug: "so-sanh-hai-diem", topic: "cach-doc", publishedAt: "2026-05-06", image: IMAGES[1] },
    { slug: "nguon-con-so", topic: "du-lieu", publishedAt: "2026-04-15", image: IMAGES[2] },
    { slug: "buoc-dinh-gia", topic: "gia", publishedAt: "2026-03-28", image: IMAGES[0] },
    { slug: "linh-dam", topic: "khu-vuc", publishedAt: "2026-03-10", image: IMAGES[1] },
];
