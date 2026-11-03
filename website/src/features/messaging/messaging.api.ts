import { AuthApiError, apiRequest } from "@/features/auth/auth.api";

import type {
    Attachment,
    ConversationDetail,
    ConversationState,
    ConversationSummary,
    CursorPage,
    DeleteRequest,
    Message,
    MessagePage,
    Person,
    Preferences,
    SearchHit,
    SharedFile,
    SharedLink,
    SharedMedia,
} from "./messaging.types";

const BASE = "/messaging";

export interface ConversationPage {
    items: ConversationSummary[];
    nextCursor: string | null;
}

export function listConversations(
    folder: "inbox" | "requests",
    options: { cursor?: string | null; q?: string } = {},
): Promise<ConversationPage> {
    const params = new URLSearchParams({ folder });
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.q) params.set("q", options.q);
    return apiRequest(`${BASE}/conversations?${params.toString()}`);
}

export function getConversation(id: string): Promise<ConversationDetail> {
    return apiRequest(`${BASE}/conversations/${id}`);
}

export function openConversation(userId: string): Promise<ConversationDetail> {
    return apiRequest(`${BASE}/conversations`, {
        method: "POST",
        body: JSON.stringify({ userId }),
    });
}

export function acceptConversation(id: string): Promise<ConversationDetail> {
    return apiRequest(`${BASE}/conversations/${id}/accept`, { method: "POST" });
}

export function declineConversation(id: string): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/decline`, { method: "POST" });
}

export function deleteConversation(id: string): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}`, { method: "DELETE" });
}

export function markRead(id: string, seq: number): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/read`, {
        method: "PUT",
        body: JSON.stringify({ seq }),
    });
}

export function muteConversation(id: string, until: string | null): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/mute`, {
        method: "PUT",
        body: JSON.stringify({ until }),
    });
}

export function listMessages(
    id: string,
    options: { beforeSeq?: number; afterSeq?: number; limit?: number } = {},
): Promise<MessagePage> {
    const params = new URLSearchParams();
    if (options.beforeSeq !== undefined) params.set("beforeSeq", String(options.beforeSeq));
    if (options.afterSeq !== undefined) params.set("afterSeq", String(options.afterSeq));
    if (options.limit) params.set("limit", String(options.limit));
    const suffix = params.toString();
    return apiRequest(`${BASE}/conversations/${id}/messages${suffix ? `?${suffix}` : ""}`);
}

export function pinConversation(id: string, pinned: boolean): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/pin`, {
        method: "PUT",
        body: JSON.stringify({ pinned }),
    });
}

export function setConversationNickname(id: string, nickname: string | null): Promise<{ nickname: string | null }> {
    return apiRequest(`${BASE}/conversations/${id}/nickname`, {
        method: "PUT",
        body: JSON.stringify({ nickname }),
    });
}

export type SharedKind = "media" | "links" | "files";
export type SharedItem<K extends SharedKind> = K extends "media" ? SharedMedia : K extends "files" ? SharedFile : SharedLink;

export function listShared<K extends SharedKind>(
    id: string,
    type: K,
    options: { cursor?: string | null; limit?: number } = {},
): Promise<CursorPage<SharedItem<K>>> {
    const params = new URLSearchParams({ type });
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.limit) params.set("limit", String(options.limit));
    return apiRequest(`${BASE}/conversations/${id}/shared?${params.toString()}`);
}

export function searchInConversation(
    id: string,
    q: string,
    options: { cursor?: string | null } = {},
): Promise<CursorPage<SearchHit>> {
    const params = new URLSearchParams({ q });
    if (options.cursor) params.set("cursor", options.cursor);
    return apiRequest(`${BASE}/conversations/${id}/search?${params.toString()}`);
}

export function requestDeleteHistory(id: string): Promise<DeleteRequest> {
    return apiRequest(`${BASE}/conversations/${id}/delete-request`, { method: "POST" });
}

export function cancelDeleteHistory(id: string): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/delete-request`, { method: "DELETE" });
}

export function acceptDeleteHistory(id: string): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/delete-request/accept`, { method: "POST" });
}

export function declineDeleteHistory(id: string): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/delete-request/decline`, { method: "POST" });
}

export interface SendInput {
    clientMsgId: string;
    kind: "text" | "image" | "file" | "post_share";
    body?: string;
    replyToSeq?: number;
    attachmentIds?: string[];
    postId?: string;
}

export function sendMessage(id: string, input: SendInput): Promise<Message> {
    return apiRequest(`${BASE}/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function unsendMessage(id: string, messageId: string): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/messages/${messageId}`, { method: "DELETE" });
}

export function reactToMessage(id: string, messageId: string, emoji: string): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/messages/${messageId}/reaction`, {
        method: "PUT",
        body: JSON.stringify({ emoji }),
    });
}

export function removeReaction(id: string, messageId: string): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/messages/${messageId}/reaction`, {
        method: "DELETE",
    });
}

export function reportMessage(
    id: string,
    messageId: string,
    input: { reasonCode: string; note?: string },
): Promise<void> {
    return apiRequest(`${BASE}/conversations/${id}/messages/${messageId}/report`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function getUnreadCount(): Promise<{ inbox: number; requests: number }> {
    return apiRequest(`${BASE}/unread-count`);
}

export function searchRecipients(q: string): Promise<{ items: Person[] }> {
    return apiRequest(`${BASE}/recipients?q=${encodeURIComponent(q)}`);
}

export function getPreferences(): Promise<Preferences> {
    return apiRequest(`${BASE}/preferences`);
}

export function updatePreferences(input: Partial<Preferences>): Promise<Preferences> {
    return apiRequest(`${BASE}/preferences`, { method: "PATCH", body: JSON.stringify(input) });
}

export function listBlocks(): Promise<{ items: Person[] }> {
    return apiRequest(`${BASE}/blocks`);
}

export function blockUser(userId: string): Promise<void> {
    return apiRequest(`${BASE}/blocks/${userId}`, { method: "PUT" });
}

export function unblockUser(userId: string): Promise<void> {
    return apiRequest(`${BASE}/blocks/${userId}`, { method: "DELETE" });
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function imageSize(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new AuthApiError("Không đọc được ảnh.", 422));
        };
        image.src = url;
    });
}

export function validateImage(file: File): string | null {
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
        return "Chỉ nhận ảnh JPEG, PNG hoặc WebP.";
    }
    if (file.size > IMAGE_MAX_BYTES) return "Ảnh lớn hơn 8 MB.";
    return null;
}

export async function uploadImage(conversationId: string, file: File): Promise<string> {
    const invalid = validateImage(file);
    if (invalid) throw new AuthApiError(invalid, 422);
    const size = await imageSize(file);
    const created = await apiRequest<{ attachmentId: string; uploadUrl: string }>(`${BASE}/attachments`, {
        method: "POST",
        body: JSON.stringify({ conversationId, contentType: file.type, byteSize: file.size }),
    });
    const uploaded = await fetch(created.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
    });
    if (!uploaded.ok) throw new AuthApiError("Chưa tải được ảnh lên.", uploaded.status);
    await apiRequest<Attachment>(`${BASE}/attachments/${created.attachmentId}/complete`, {
        method: "POST",
        body: JSON.stringify(size),
    });
    return created.attachmentId;
}

export const FILE_MAX_BYTES = 20 * 1024 * 1024;

/** Loại tệp cho phép, theo đuôi: trình duyệt hay trả sai `file.type` cho csv/docx nên đuôi là nguồn chính. */
const FILE_TYPES: Readonly<Record<string, string>> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
};

export const FILE_ACCEPT = Object.keys(FILE_TYPES)
    .map((extension) => `.${extension}`)
    .join(",");

export function fileContentType(file: File): string | null {
    const dot = file.name.lastIndexOf(".");
    const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
    return Object.prototype.hasOwnProperty.call(FILE_TYPES, extension) ? (FILE_TYPES[extension] ?? null) : null;
}

export function validateFile(file: File): string | null {
    if (!fileContentType(file)) return "Chỉ nhận tệp PDF, Word, Excel, PowerPoint, TXT hoặc CSV.";
    if (file.size <= 0) return "Tệp rỗng.";
    if (file.size > FILE_MAX_BYTES) return "Tệp lớn hơn 20 MB.";
    return null;
}

export async function uploadFile(conversationId: string, file: File): Promise<string> {
    const invalid = validateFile(file);
    const contentType = fileContentType(file);
    if (invalid || !contentType) throw new AuthApiError(invalid ?? "Tệp không hợp lệ.", 422);
    const created = await apiRequest<{ attachmentId: string; uploadUrl: string }>(`${BASE}/attachments`, {
        method: "POST",
        body: JSON.stringify({ conversationId, contentType, byteSize: file.size, fileName: file.name }),
    });
    const uploaded = await fetch(created.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: file,
    });
    if (!uploaded.ok) throw new AuthApiError("Chưa tải được tệp lên.", uploaded.status);
    await apiRequest<Attachment>(`${BASE}/attachments/${created.attachmentId}/complete`, {
        method: "POST",
        body: JSON.stringify({}),
    });
    return created.attachmentId;
}

// --- Quản trị -------------------------------------------------------------

export interface ReportContextItem {
    seq: number;
    senderId: string;
    senderName: string;
    kind: string;
    body: string;
    status: string;
    createdAt: string;
    reported: boolean;
    attachments: Array<{ id: string; url: string }>;
}

export interface AdminReport {
    id: string;
    reasonCode: string;
    note: string | null;
    status: "open" | "dismissed" | "actioned";
    createdAt: string;
    reporter: Person | undefined;
    reported: Person | undefined;
    messageSeq: number;
    context: ReportContextItem[];
}

export function listReports(
    status: AdminReport["status"],
    cursor?: string | null,
): Promise<{ items: AdminReport[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ status });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/admin/messaging/reports?${params.toString()}`);
}

export function resolveReport(
    id: string,
    action: "dismiss" | "hide_message",
    reason: string,
): Promise<{ id: string; status: string }> {
    return apiRequest(`/admin/messaging/reports/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
    });
}

export type { ConversationState };
