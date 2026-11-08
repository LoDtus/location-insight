import { apiRequest } from "@/features/auth/auth.api";
import { ARTICLE_TOPICS, type ArticleCard, type ArticleFormat, type ArticleTopic } from "@/features/articles/articles";

export type ArticleStatus = "draft" | "scheduled" | "published" | "hidden";

export type AdminArticle = {
    id: string;
    slug: string;
    title: string;
    lede: string;
    body: string;
    topic: ArticleTopic;
    status: ArticleStatus;
    publishedAt: string | null;
    coverImage: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    format?: ArticleFormat;
    videoUrl?: string | null;
    source: "manual" | "ai";
    idempotencyKey: string | null;
    reviewNote: string | null;
    updatedAt: string;
    deletedAt: string | null;
};

export type AdminArticleList = {
    items: AdminArticle[];
    page: number;
    pageSize: number;
    total: number;
    counts: Record<ArticleStatus, number>;
};

export type FrequencyGrain = "day" | "month" | "year";

export type PublishedFrequency = {
    grain: FrequencyGrain;
    from: string;
    /** Mốc cuối thực tế (máy chủ cắt ở `latest`, không trả tương lai). */
    to: string;
    /** Ngày xa nhất được xem (YYYY-MM-DD): hôm nay, hoặc ngày đăng của bài đặt lịch xa nhất. */
    latest: string;
    total: number;
    scheduledTotal: number;
    /** `count`: đã đăng (gồm bài đặt lịch đã tới giờ); `scheduled`: đặt lịch chưa tới giờ. */
    points: { bucket: string; count: number; scheduled: number }[];
};

export type ArticleAuthor = { name: string; username: string | null; avatarUrl: string | null };
export type ArticleStats = { upvotes: number; downvotes: number; comments: number };
export type ArticleVote = 1 | -1 | 0;

export type ArticleComment = {
    id: string;
    parentId: string | null;
    body: string;
    removed: boolean;
    author: ArticleAuthor | null;
    createdAt: string;
    editedAt: string | null;
    likes: number;
    mine: boolean;
};

export type ArticleThread = ArticleComment & { replies: ArticleComment[] };

export type ArticleCommentPage = { items: ArticleThread[]; page: number; pageSize: number; total: number };

export type ArticleWrite = {
    title: string;
    slug: string;
    lede: string;
    body: string;
    topic: ArticleTopic;
    status: ArticleStatus;
    publishedAt: string | null;
    coverImage: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    /** standard | photo | video: bài ảnh/video lên mục "Video / Ảnh" của trang /bai-viet. */
    format: ArticleFormat;
    /** Liên kết YouTube/Vimeo (bắt buộc với bài video). */
    videoUrl: string | null;
};

export const ARTICLE_FORMAT_LABEL: Record<ArticleFormat, string> = {
    standard: "Bài thường",
    photo: "Ảnh",
    video: "Video",
};

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
    draft: "Nháp",
    scheduled: "Đã lên lịch",
    published: "Đã đăng",
    hidden: "Ẩn",
};

export function listAdminArticles(query: {
    q?: string;
    status?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
}): Promise<AdminArticleList> {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (query.sort) params.set("sort", query.sort);
    if (query.page && query.page > 1) params.set("page", String(query.page));
    if (query.pageSize) params.set("pageSize", String(query.pageSize));
    const suffix = params.toString();
    return apiRequest<AdminArticleList>(`/admin/blogs${suffix ? `?${suffix}` : ""}`);
}

export function locateAdminArticle(query: {
    id: string;
    q?: string;
    status?: string;
    sort?: string;
    pageSize?: number;
}): Promise<{ found: boolean; page: number; index: number }> {
    const params = new URLSearchParams({ id: query.id });
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (query.sort) params.set("sort", query.sort);
    if (query.pageSize) params.set("pageSize", String(query.pageSize));
    return apiRequest(`/admin/blogs/position?${params}`);
}

export function listPublishedFrequency(query: {
    grain: FrequencyGrain;
    from: string;
    to: string;
}): Promise<PublishedFrequency> {
    const params = new URLSearchParams(query);
    return apiRequest<PublishedFrequency>(`/admin/blogs/frequency?${params}`);
}

export function getAdminArticle(id: string): Promise<AdminArticle> {
    return apiRequest<AdminArticle>(`/admin/blogs/${id}`);
}

export function createAdminArticle(body: ArticleWrite): Promise<AdminArticle> {
    return apiRequest<AdminArticle>("/admin/blogs", { method: "POST", body: JSON.stringify(body) });
}

export function updateAdminArticle(id: string, body: ArticleWrite): Promise<AdminArticle> {
    return apiRequest<AdminArticle>(`/admin/blogs/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function hideAdminArticle(id: string): Promise<AdminArticle> {
    return apiRequest<AdminArticle>(`/admin/blogs/${id}/hide`, { method: "POST" });
}

export function deleteAdminArticle(id: string): Promise<{ id: string }> {
    return apiRequest<{ id: string }>(`/admin/blogs/${id}`, { method: "DELETE" });
}

export function restoreAdminArticle(id: string): Promise<AdminArticle> {
    return apiRequest<AdminArticle>(`/admin/blogs/${id}/restore`, { method: "POST" });
}

export { ARTICLE_TOPICS };

export function publishAdminArticle(id: string): Promise<AdminArticle> {
    return apiRequest<AdminArticle>(`/admin/blogs/${id}/publish`, { method: "POST" });
}

export function getAdminArticleBySlug(slug: string): Promise<AdminArticle> {
    return apiRequest<AdminArticle>(`/admin/blogs/by-slug/${encodeURIComponent(slug)}`);
}

const articlePath = (slug: string): string => `/articles/${encodeURIComponent(slug)}`;

export function getArticleMe(slug: string): Promise<{ myVote: ArticleVote; likedCommentIds: string[] }> {
    return apiRequest(`${articlePath(slug)}/me`);
}

export function voteArticle(slug: string, value: ArticleVote): Promise<ArticleStats & { myVote: ArticleVote }> {
    return apiRequest(`${articlePath(slug)}/vote`, { method: "PUT", body: JSON.stringify({ value }) });
}

export function listArticleComments(slug: string, sort: "new" | "top", page: number): Promise<ArticleCommentPage> {
    const params = new URLSearchParams({ sort, page: String(page) });
    return apiRequest(`${articlePath(slug)}/comments?${params}`);
}

export function createArticleComment(slug: string, body: string, parentId?: string): Promise<ArticleComment> {
    return apiRequest(`${articlePath(slug)}/comments`, { method: "POST", body: JSON.stringify({ body, parentId }) });
}

export function editArticleComment(id: string, body: string): Promise<ArticleComment> {
    return apiRequest(`/articles/comments/${id}`, { method: "PATCH", body: JSON.stringify({ body }) });
}

export function deleteArticleComment(id: string): Promise<{ id: string }> {
    return apiRequest(`/articles/comments/${id}`, { method: "DELETE" });
}

export function likeArticleComment(id: string, liked: boolean): Promise<{ id: string; likes: number; liked: boolean }> {
    return apiRequest(`/articles/comments/${id}/like`, { method: "PUT", body: JSON.stringify({ liked }) });
}

export function getArticleStats(slug: string): Promise<ArticleStats> {
    return apiRequest(`${articlePath(slug)}/stats`);
}

/** Đề xuất riêng cho người đã đăng nhập (theo chủ đề họ hay tương tác). */
export function listRecommendedForMe(): Promise<ArticleCard[]> {
    return apiRequest<ArticleCard[]>("/articles/recommended/me");
}

/** Ghi một lượt đọc (máy chủ chỉ tính một lần/người/bài/ngày). */
export function recordArticleView(slug: string): Promise<{ counted: boolean }> {
    return apiRequest(`/articles/${encodeURIComponent(slug)}/view`, { method: "POST" });
}
