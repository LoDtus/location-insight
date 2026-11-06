import { AuthApiError, apiRequest } from "@/features/auth/auth.api";

export interface DiscussionTopic {
    id: string;
    name: string;
    slug: string;
    summary: string;
    status: "open" | "locked" | "hidden";
    createdAt: string;
}

export interface DiscussionMedia {
    id: string;
    kind: "image" | "video";
    contentType: string;
    url: string;
}

export interface DiscussionPost {
    id: string;
    authorId: string;
    authorName: string;
    authorUsername: string | null;
    authorAvatarUrl: string | null;
    topicId: string;
    topicSlug: string;
    topicName: string;
    rootId: string | null;
    parentId: string | null;
    parentAuthorName: string | null;
    kind: "question" | "note" | "reply";
    body: string;
    replyCount: number;
    likeCount: number;
    likedByMe: boolean;
    /** Người xem đã lưu bài này (lưu ở server, đồng bộ mọi thiết bị). */
    savedByMe: boolean;
    createdAt: string;
    media: DiscussionMedia[];
}

export interface DiscussionPage<T> {
    items: T[];
    nextCursor: string | null;
}

export function listTopics(cursor?: string): Promise<DiscussionPage<DiscussionTopic>> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return apiRequest(`/discussions/topics${query}`);
}

export function createTopic(input: {
    name: string;
    slug: string;
    summary?: string;
}): Promise<DiscussionTopic> {
    return apiRequest("/discussions/topics", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function listPosts(cursor?: string, scope?: "following"): Promise<DiscussionPage<DiscussionPost>> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (scope) params.set("scope", scope);
    const query = params.toString();
    return apiRequest(`/discussions/posts${query ? `?${query}` : ""}`);
}

export type AuthorPostSort = "newest" | "interactions" | "oldest";

export function listAuthorPosts(
    username: string,
    cursor?: string,
    sort: AuthorPostSort = "newest",
): Promise<DiscussionPage<DiscussionPost>> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (sort !== "newest") params.set("sort", sort);
    const suffix = params.toString();
    return apiRequest(`/discussions/authors/${encodeURIComponent(username)}/posts${suffix ? `?${suffix}` : ""}`);
}

export function topicFeed(
    slug: string,
    cursor?: string,
): Promise<{ topic: DiscussionTopic } & DiscussionPage<DiscussionPost>> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return apiRequest(`/discussions/topics/${encodeURIComponent(slug)}${query}`);
}

export function createPost(input: {
    topicSlug: string;
    kind: "question" | "note";
    body: string;
    mediaIds?: string[];
}): Promise<DiscussionPost> {
    return apiRequest("/discussions/posts", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function getThread(
    id: string,
    cursor?: string,
): Promise<{ post: DiscussionPost; replies: DiscussionPost[]; nextCursor: string | null }> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return apiRequest(`/discussions/posts/${id}${query}`);
}

export function replyToPost(
    id: string,
    input: { body: string; parentId?: string; mediaIds?: string[] },
): Promise<DiscussionPost> {
    return apiRequest(`/discussions/posts/${id}/replies`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function deletePost(id: string): Promise<void> {
    return apiRequest(`/discussions/posts/${id}`, { method: "DELETE" });
}

export function likePost(id: string): Promise<{ likeCount: number }> {
    return apiRequest(`/discussions/posts/${id}/likes`, { method: "POST" });
}

export function unlikePost(id: string): Promise<{ likeCount: number }> {
    return apiRequest(`/discussions/posts/${id}/likes`, { method: "DELETE" });
}

export function bookmarkPost(id: string): Promise<{ saved: boolean }> {
    return apiRequest(`/discussions/posts/${id}/bookmark`, { method: "PUT" });
}

export function unbookmarkPost(id: string): Promise<{ saved: boolean }> {
    return apiRequest(`/discussions/posts/${id}/bookmark`, { method: "DELETE" });
}

/** Bài đã lưu, mới lưu trước. */
export function listBookmarks(cursor?: string): Promise<DiscussionPage<DiscussionPost>> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return apiRequest(`/discussions/bookmarks${query}`);
}

export const REPORT_REASONS = [
    { id: "spam", label: "Spam, quảng cáo", hint: "Đăng lặp lại, rao vặt không liên quan, link rác" },
    { id: "scam", label: "Lừa đảo", hint: "Mời chuyển tiền, đặt cọc giả, giả danh môi giới hay chủ nhà" },
    { id: "harassment", label: "Quấy rối, xúc phạm", hint: "Công kích cá nhân, đe dọa, ngôn từ thù ghét" },
    { id: "misinformation", label: "Thông tin sai", hint: "Sai sự thật về quy hoạch, pháp lý, giá" },
    { id: "inappropriate", label: "Nội dung không phù hợp", hint: "Bạo lực, khiêu dâm, thông tin cá nhân của người khác" },
    { id: "other", label: "Lý do khác", hint: "Mô tả thêm ở ô bên dưới" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export function reportPost(id: string, input: { reason: ReportReason; note?: string }): Promise<{ reported: true }> {
    return apiRequest(`/discussions/posts/${id}/report`, { method: "POST", body: JSON.stringify(input) });
}

export async function uploadDiscussionFile(file: File): Promise<string> {
    const created = await apiRequest<{ id: string; uploadUrl: string }>("/discussions/media", {
        method: "POST",
        body: JSON.stringify({ contentType: file.type, byteSize: file.size }),
    });
    const uploaded = await fetch(created.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
    });
    if (!uploaded.ok) {
        throw new AuthApiError("Chưa tải được tệp.", uploaded.status);
    }
    await apiRequest(`/discussions/media/${created.id}/complete`, { method: "POST" });
    return created.id;
}

export function slugifyTopic(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

export interface PostReport {
    id: string;
    reason: ReportReason;
    note: string;
    status: "open" | "actioned" | "dismissed";
    createdAt: string;
    reportCount: number;
    post: { id: string; body: string; status: "visible" | "hidden" | "deleted"; authorName: string; authorUsername: string | null; rootId: string | null } | null;
    reporterName: string;
}

/** Kiểm duyệt: báo cáo bài theo trạng thái (mới nhất trước, tối đa 100). */
export function listPostReports(status: PostReport["status"]): Promise<PostReport[]> {
    return apiRequest(`/admin/discussions/reports?status=${status}`);
}

/** `actioned` ẩn bài và đóng mọi báo cáo mở của bài; `dismissed` giữ bài. Lý do ≥ 5 ký tự, ghi nhật ký. */
export function resolvePostReport(id: string, status: "actioned" | "dismissed", reason: string): Promise<{ id: string }> {
    return apiRequest(`/admin/discussions/reports/${id}/resolve`, { method: "POST", body: JSON.stringify({ status, reason }) });
}
