export type ConversationState = "pending" | "active" | "declined";
export type MessageKind = "text" | "image" | "post_share" | "system";

export interface Person {
    id: string;
    displayName: string;
    avatarUrl: string | null;
}

export interface Attachment {
    id: string;
    contentType: string;
    width: number;
    height: number;
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
    kind: "text" | "image" | "post_share";
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
};
