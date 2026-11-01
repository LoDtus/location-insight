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
    createdAt: string;
    media: DiscussionMedia[];
}

export interface DiscussionPage<T> {
    items: T[];
    nextCursor: string | null;
}

export interface DiscussionReport {
    id: string;
    postId: string;
    topicId: string | null;
    topicName: string;
    body: string;
    reason: string;
    reporterName: string;
    createdAt: string;
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

export function listPosts(cursor?: string): Promise<DiscussionPage<DiscussionPost>> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return apiRequest(`/discussions/posts${query}`);
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
): Promise<{ post: DiscussionPost; replies: DiscussionPost[]; nextCursor: string | null }> {
    return apiRequest(`/discussions/posts/${id}`);
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

export function reportPost(id: string, reason: string): Promise<{ id: string }> {
    return apiRequest(`/discussions/posts/${id}/reports`, {
        method: "POST",
        body: JSON.stringify({ reason }),
    });
}

export function listReports(): Promise<DiscussionReport[]> {
    return apiRequest("/admin/discussions/reports");
}

export function hidePost(id: string, hidden: boolean, reason: string) {
    return apiRequest(`/admin/discussions/posts/${id}/hide`, {
        method: "POST",
        body: JSON.stringify({ hidden, reason }),
    });
}

export function setTopicStatus(
    id: string,
    status: "open" | "locked" | "hidden",
    reason: string,
) {
    return apiRequest(`/admin/discussions/topics/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status, reason }),
    });
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
