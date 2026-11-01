import { AuthApiError, apiRequest } from "@/features/auth/auth.api";

export type FeedbackCategory = "bug" | "idea" | "question" | "other";
export type FeedbackStatus = "open" | "in_progress" | "resolved" | "closed";

export interface FeedbackMedia {
    id: string;
    kind: "image" | "video";
    contentType: string;
    url: string;
}

export interface FeedbackItem {
    id: string;
    category: FeedbackCategory;
    description: string;
    status: FeedbackStatus;
    replyCount: number;
    lastReplyBy: "user" | "admin" | null;
    unread: boolean;
    createdAt: string;
    lastActivityAt: string;
    author: { id: string; displayName: string; avatarUrl: string | null };
    media: FeedbackMedia[];
}

export interface FeedbackReply {
    id: string;
    authorRole: "user" | "admin";
    authorName: string;
    body: string;
    createdAt: string;
}

export interface FeedbackDetail extends FeedbackItem {
    replies: FeedbackReply[];
}

export interface FeedbackPage {
    items: FeedbackItem[];
    nextCursor: string | null;
}

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
    bug: "Báo lỗi",
    idea: "Ý tưởng",
    question: "Câu hỏi",
    other: "Khác",
};

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
    open: "Mới",
    in_progress: "Đang xử lý",
    resolved: "Đã xử lý",
    closed: "Đã đóng",
};

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX = 8 * 1024 * 1024;
export const VIDEO_MAX = 50 * 1024 * 1024;
export const MAX_IMAGES = 4;

export function validateFile(file: File): string | null {
    if (file.type === "video/mp4") return file.size > VIDEO_MAX ? "Video lớn hơn 50 MB." : null;
    if (IMAGE_TYPES.includes(file.type)) return file.size > IMAGE_MAX ? "Ảnh lớn hơn 8 MB." : null;
    return "Chỉ nhận ảnh JPEG, PNG, WebP hoặc video MP4.";
}

function query(params: Record<string, string | null | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `?${text}` : "";
}

export function listMine(cursor?: string | null): Promise<FeedbackPage> {
    return apiRequest(`/feedback${query({ cursor })}`);
}

export function getMine(id: string): Promise<FeedbackDetail> {
    return apiRequest(`/feedback/${id}`);
}

export function createFeedback(input: {
    category: FeedbackCategory;
    description: string;
    mediaIds: string[];
}): Promise<FeedbackDetail> {
    return apiRequest("/feedback", { method: "POST", body: JSON.stringify(input) });
}

export function replyMine(id: string, body: string): Promise<FeedbackDetail> {
    return apiRequest(`/feedback/${id}/replies`, { method: "POST", body: JSON.stringify({ body }) });
}

export function getUnreadReplies(): Promise<{ count: number }> {
    return apiRequest("/feedback/unread-count");
}

export function listAll(
    filters: { status?: FeedbackStatus | ""; category?: FeedbackCategory | ""; cursor?: string | null } = {},
): Promise<FeedbackPage> {
    return apiRequest(`/admin/feedback${query(filters)}`);
}

export function getAny(id: string): Promise<FeedbackDetail> {
    return apiRequest(`/admin/feedback/${id}`);
}

export function replyAdmin(id: string, body: string): Promise<FeedbackDetail> {
    return apiRequest(`/admin/feedback/${id}/replies`, { method: "POST", body: JSON.stringify({ body }) });
}

export function setStatus(id: string, status: FeedbackStatus): Promise<FeedbackDetail> {
    return apiRequest(`/admin/feedback/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
}

export function getOpenCount(): Promise<{ count: number }> {
    return apiRequest("/admin/feedback/open-count");
}

export async function uploadFeedbackFile(file: File): Promise<string> {
    const problem = validateFile(file);
    if (problem) throw new AuthApiError(problem, 422);
    const created = await apiRequest<{ id: string; uploadUrl: string }>("/feedback/media", {
        method: "POST",
        body: JSON.stringify({ contentType: file.type, byteSize: file.size }),
    });
    const uploaded = await fetch(created.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
    });
    if (!uploaded.ok) throw new AuthApiError("Chưa tải được tệp lên.", uploaded.status);
    await apiRequest(`/feedback/media/${created.id}/complete`, { method: "POST" });
    return created.id;
}

export function errorText(error: unknown, fallback = "Chưa thực hiện được. Hãy thử lại."): string {
    return error instanceof AuthApiError && error.message ? error.message : fallback;
}
