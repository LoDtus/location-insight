import {
    EMPTY_THREAD,
    type ConversationSummary,
    type Message,
    type MessagingState,
    type ThreadState,
} from "./messaging.types";

export const UNSENT_PREVIEW = "Tin nhắn đã thu hồi";

export function initialState(): MessagingState {
    return {
        conversations: {},
        listLoaded: false,
        listError: "",
        cursors: { inbox: null, requests: null },
        unread: { inbox: 0, requests: 0 },
        threads: {},
        typing: {},
        realtime: "idle",
        viewerId: null,
    };
}

/** Hợp nhất theo seq, tin mới ghi đè tin cũ, kết quả tăng dần theo seq. */
export function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
    if (!incoming.length) return existing;
    const bySeq = new Map<number, Message>();
    for (const item of existing) bySeq.set(item.seq, item);
    for (const item of incoming) {
        const previous = bySeq.get(item.seq);
        // clientMsgId chỉ có ở bản của người gửi; giữ lại khi bản sự kiện trả về null.
        bySeq.set(item.seq, previous && !item.clientMsgId ? { ...item, clientMsgId: previous.clientMsgId } : item);
    }
    return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export function previewOf(message: Pick<Message, "kind" | "body" | "status">): string {
    if (message.status === "deleted") return UNSENT_PREVIEW;
    if (message.kind === "image") return message.body ? clip(message.body) : "Đã gửi ảnh";
    if (message.kind === "file") return message.body ? clip(message.body) : "Đã gửi một tệp";
    if (message.kind === "post_share") return "Đã gửi một bài viết";
    return clip(message.body);
}

function clip(value: string, max = 120): string {
    const chars = Array.from(value.replace(/\s+/g, " ").trim());
    return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("")}…`;
}

export function getThread(state: MessagingState, id: string): ThreadState {
    return state.threads[id] ?? EMPTY_THREAD;
}

export function withThread(
    state: MessagingState,
    id: string,
    patch: Partial<ThreadState> | ((thread: ThreadState) => Partial<ThreadState>),
): MessagingState {
    const current = getThread(state, id);
    const next = typeof patch === "function" ? patch(current) : patch;
    return { ...state, threads: { ...state.threads, [id]: { ...current, ...next } } };
}

export function upsertConversations(
    state: MessagingState,
    items: ConversationSummary[],
): MessagingState {
    if (!items.length) return state;
    const conversations = { ...state.conversations };
    for (const item of items) {
        const previous = conversations[item.id];
        // Không để bản cũ từ máy chủ kéo lùi con trỏ đã đọc hoặc seq đã biết.
        conversations[item.id] =
            previous && previous.lastSeq > item.lastSeq ? { ...item, lastSeq: previous.lastSeq } : item;
    }
    return { ...state, conversations };
}

export function removeConversation(state: MessagingState, id: string): MessagingState {
    const conversations = { ...state.conversations };
    delete conversations[id];
    const threads = { ...state.threads };
    delete threads[id];
    return { ...state, conversations, threads };
}

export interface MessageCreatedPayload {
    conversationId: string;
    state?: ConversationSummary["state"];
    initiatorId?: string;
    message: Message;
}

export function applyMessageCreated(
    state: MessagingState,
    payload: MessageCreatedPayload,
    viewerId: string,
    openId: string | null,
): { state: MessagingState; unknown: boolean } {
    const { conversationId, message } = payload;
    let next = state;
    const thread = state.threads[conversationId];
    if (thread) {
        next = withThread(next, conversationId, (current) => ({
            messages: mergeMessages(current.messages, [message]),
            pending: message.clientMsgId
                ? current.pending.filter((item) => item.clientMsgId !== message.clientMsgId)
                : current.pending,
        }));
    }
    const known = state.conversations[conversationId];
    if (!known) return { state: next, unknown: true };
    const mine = message.senderId === viewerId;
    const viewing = openId === conversationId && typeof document !== "undefined" && document.visibilityState === "visible";
    const lastReadSeq = mine ? message.seq : known.lastReadSeq;
    const summary: ConversationSummary = {
        ...known,
        state: payload.state ?? known.state,
        lastSeq: Math.max(known.lastSeq, message.seq),
        lastReadSeq,
        unread: !mine && !viewing && message.seq > lastReadSeq,
        lastMessagePreview: message.seq >= known.lastSeq ? previewOf(message) : known.lastMessagePreview,
        lastMessageAt: message.seq >= known.lastSeq ? message.createdAt : known.lastMessageAt,
        lastSenderIsMe: message.seq >= known.lastSeq ? mine : known.lastSenderIsMe,
    };
    return {
        state: { ...next, conversations: { ...next.conversations, [conversationId]: summary } },
        unknown: false,
    };
}

export function applyMessageUpdated(
    state: MessagingState,
    payload: { conversationId: string; seq: number },
): MessagingState {
    const { conversationId, seq } = payload;
    let next = state;
    if (state.threads[conversationId]) {
        next = withThread(next, conversationId, (current) => ({
            messages: current.messages.map((item) =>
                item.seq === seq
                    ? { ...item, status: "deleted" as const, body: "", attachments: [], reactions: [], sharedPost: null, replyTo: null }
                    : item,
            ),
        }));
    }
    const conversation = state.conversations[conversationId];
    if (conversation && conversation.lastSeq === seq) {
        next = {
            ...next,
            conversations: {
                ...next.conversations,
                [conversationId]: { ...conversation, lastMessagePreview: UNSENT_PREVIEW },
            },
        };
    }
    return next;
}

export function applyReaction(
    state: MessagingState,
    payload: {
        conversationId: string;
        seq: number;
        userId: string;
        emoji: string | null;
        previousEmoji?: string | null;
    },
    viewerId: string,
): MessagingState {
    if (!state.threads[payload.conversationId]) return state;
    return withThread(state, payload.conversationId, (current) => ({
        messages: current.messages.map((item) => {
            if (item.seq !== payload.seq) return item;
            const mine = payload.userId === viewerId;
            const groups = new Map(item.reactions.map((reaction) => [reaction.emoji, { ...reaction }]));
            // Chính mình: đặt lại theo trạng thái (idempotent, an toàn khi cập nhật lạc quan).
            // Người khác: trừ cảm xúc cũ do máy chủ báo, cộng cảm xúc mới.
            const previous = mine
                ? ([...groups.values()].find((group) => group.mine)?.emoji ?? null)
                : (payload.previousEmoji ?? null);
            if (previous) {
                const group = groups.get(previous);
                if (group) {
                    group.count -= 1;
                    if (mine) group.mine = false;
                    if (group.count <= 0) groups.delete(previous);
                }
            }
            if (payload.emoji) {
                const group = groups.get(payload.emoji) ?? { emoji: payload.emoji, count: 0, mine: false };
                group.count += 1;
                if (mine) group.mine = true;
                groups.set(payload.emoji, group);
            }
            return { ...item, reactions: [...groups.values()] };
        }),
    }));
}

export function applyRead(
    state: MessagingState,
    payload: { conversationId: string; userId: string; lastReadSeq: number },
    viewerId: string,
): MessagingState {
    const { conversationId } = payload;
    if (payload.userId === viewerId) {
        const conversation = state.conversations[conversationId];
        if (!conversation) return state;
        const lastReadSeq = Math.max(conversation.lastReadSeq, payload.lastReadSeq);
        return {
            ...state,
            conversations: {
                ...state.conversations,
                [conversationId]: { ...conversation, lastReadSeq, unread: conversation.lastSeq > lastReadSeq },
            },
        };
    }
    if (!state.threads[conversationId]) return state;
    return withThread(state, conversationId, (current) => ({
        peerLastReadSeq: Math.max(current.peerLastReadSeq ?? 0, payload.lastReadSeq),
    }));
}

export type Folder = "inbox" | "requests";

export function inFolder(conversation: ConversationSummary, folder: Folder): boolean {
    if (folder === "requests") return conversation.state === "pending" && !conversation.iAmInitiator;
    return conversation.state === "active" || conversation.iAmInitiator;
}

export function selectFolder(state: MessagingState, folder: Folder): ConversationSummary[] {
    // Hội thoại ghim (chỉ Inbox) đứng trước, trong mỗi nhóm mới nhất trước.
    return Object.values(state.conversations)
        .filter((item) => inFolder(item, folder) && item.lastSeq > 0)
        .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
        });
}
