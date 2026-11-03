export type ConversationState = "pending" | "active" | "declined";
export type MessageKind = "text" | "image" | "file" | "post_share" | "system";

export interface Person {
    id: string;
    displayName: string;
    avatarUrl: string | null;
}

export interface Attachment {
    id: string;
    kind: "image" | "file";
    contentType: string;
    width: number;
    height: number;
    fileName: string | null;
    byteSize: number;
    url: string;
}

export interface Reaction {
    emoji: string;
    count: number;
    mine: boolean;
}

export interface Message {
    id: string;
    conversationId: string;
    seq: number;
    senderId: string;
    kind: MessageKind;
    body: string;
    status: "visible" | "deleted";
    clientMsgId: string | null;
    replyTo: { seq: number; senderId: string; excerpt: string } | null;
    attachments: Attachment[];
    sharedPost: { id: string; excerpt: string; authorName: string; available: boolean } | null;
    reactions: Reaction[];
    createdAt: string;
}

export interface ConversationSummary {
    id: string;
    type: "direct";
    state: ConversationState;
    peer: Person;
    lastSeq: number;
    lastReadSeq: number;
    unread: boolean;
    muted: boolean;
    /** Đã ghim lên đầu Inbox (chỉ phía mình). */
    pinned: boolean;
    /** Biệt danh mình đặt cho người kia; chỉ mình thấy. */
    nickname: string | null;
    lastMessagePreview: string;
    lastMessageAt: string | null;
    lastSenderIsMe: boolean;
    iAmInitiator: boolean;
}

export interface ConversationDetail extends ConversationSummary {
    peerLastReadSeq: number | null;
    peerPresence: { online: boolean; lastActiveAt: string | null } | null;
    canSend: boolean;
    blockedByMe: boolean;
    /** Yêu cầu xóa lịch sử hai phía đang chờ (của mình hoặc của người kia). */
    deleteRequest: DeleteRequest | null;
}

export interface DeleteRequest {
    id: string;
    byMe: boolean;
    createdAt: string;
}

export interface SharedMedia {
    id: string;
    messageId: string;
    messageSeq: number;
    senderId: string;
    createdAt: string;
    contentType: string;
    width: number;
    height: number;
    url: string;
}

export interface SharedFile {
    id: string;
    messageId: string;
    messageSeq: number;
    senderId: string;
    createdAt: string;
    fileName: string;
    contentType: string;
    byteSize: number;
    url: string;
}

export interface SharedLink {
    messageId: string;
    messageSeq: number;
    senderId: string;
    createdAt: string;
    url: string;
    host: string;
}

export interface SearchHit {
    messageId: string;
    seq: number;
    senderId: string;
    createdAt: string;
    snippet: string;
}

export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
}

export interface Preferences {
    whoCanMessage: "everyone" | "nobody";
    showActivityStatus: boolean;
    sendReadReceipts: boolean;
}

export interface MessagePage {
    items: Message[];
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    lastSeq: number;
    peerLastReadSeq: number | null;
}

/** Tin đang gửi hoặc gửi lỗi, chỉ tồn tại ở client. */
export interface PendingMessage {
    clientMsgId: string;
    conversationId: string;
    kind: "text" | "image" | "file" | "post_share";
    body: string;
    replyToSeq: number | null;
    files: File[];
    previews: string[];
    postId: string | null;
    status: "sending" | "failed";
    error: string;
    createdAt: string;
}

export interface ThreadState {
    messages: Message[];
    pending: PendingMessage[];
    detail: ConversationDetail | null;
    hasMoreBefore: boolean;
    loaded: boolean;
    loadingOlder: boolean;
    peerLastReadSeq: number | null;
    error: string;
    /** Tin cần cuộn tới và nhấn mạnh (từ tìm kiếm hoặc danh sách đã gửi); Thread xử lý rồi xóa. */
    jumpSeq: number | null;
}

export type RealtimeStatus = "idle" | "connecting" | "online" | "offline";

export interface MessagingState {
    conversations: Record<string, ConversationSummary>;
    listLoaded: boolean;
    listError: string;
    cursors: { inbox: string | null; requests: string | null };
    unread: { inbox: number; requests: number };
    threads: Record<string, ThreadState>;
    typing: Record<string, number>;
    realtime: RealtimeStatus;
    viewerId: string | null;
}

export const EMPTY_THREAD: ThreadState = {
    messages: [],
    pending: [],
    detail: null,
    hasMoreBefore: false,
    loaded: false,
    loadingOlder: false,
    peerLastReadSeq: null,
    error: "",
    jumpSeq: null,
};
