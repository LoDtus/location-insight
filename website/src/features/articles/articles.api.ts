import { apiRequest } from "@/features/auth/auth.api";
import { ARTICLE_TOPICS, type ArticleTopic } from "@/features/articles/articles";

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
};

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
    draft: "Nháp",
    scheduled: "Đã lên lịch",
    published: "Đã đăng",
    hidden: "Ẩn",
};

export function listAdminArticles(query: { q?: string; status?: string; page?: number }): Promise<AdminArticleList> {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (query.page && query.page > 1) params.set("page", String(query.page));
    const suffix = params.toString();
    return apiRequest<AdminArticleList>(`/admin/blogs${suffix ? `?${suffix}` : ""}`);
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
