import { AuthApiError } from "@/features/auth/auth.api";

import * as api from "./messaging.api";
import {
    applyMessageCreated,
    applyMessageUpdated,
    applyReaction,
    applyRead,
    getThread,
    inFolder,
    mergeMessages,
    previewOf,
    removeConversation,
    upsertConversations,
    withThread,
    type MessageCreatedPayload,
} from "./messaging.reducers";
import { realtime, type ServerEvent } from "./messaging.realtime";
import { messagingStore } from "./messaging.store";
import type {
    ConversationDetail,
    ConversationSummary,
    Message,
    PendingMessage,
} from "./messaging.types";

let openId: string | null = null;
const readTimers = new Map<string, ReturnType<typeof setTimeout>>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastTypingSent = new Map<string, number>();
let unreadTimer: ReturnType<typeof setTimeout> | null = null;

const TYPING_VISIBLE_MS = 5000;
const TYPING_THROTTLE_MS = 2000;

function viewer(): string {
    return messagingStore.getState().viewerId ?? "";
}

export function errorText(error: unknown, fallback = "Chưa thực hiện được. Hãy thử lại."): string {
    if (error instanceof AuthApiError) return error.message || fallback;
    return fallback;
}

function toSummary(detail: ConversationDetail): ConversationSummary {
    const { peerLastReadSeq, peerPresence, canSend, blockedByMe, ...summary } = detail;
    void peerLastReadSeq;
    void peerPresence;
    void canSend;
    void blockedByMe;
    return summary;
}

// --- Khởi động / dừng -----------------------------------------------------

export function startMessaging(userId: string): void {
    if (messagingStore.getState().viewerId === userId && realtime.connected) return;
    messagingStore.update((state) => ({ ...state, viewerId: userId }));
    realtime.start({
        onStatus: (realtimeStatus) =>
            messagingStore.update((state) => ({ ...state, realtime: realtimeStatus })),
        onOpen: () => {
            void resync();
        },
        onEvent: handleEvent,
    });
    void refreshUnread();
}

export function stopMessaging(): void {
    realtime.stop();
    for (const timer of readTimers.values()) clearTimeout(timer);
    for (const timer of typingTimers.values()) clearTimeout(timer);
    readTimers.clear();
    typingTimers.clear();
    lastTypingSent.clear();
    openId = null;
    messagingStore.reset();
}

export function setOpenConversation(id: string | null): void {
    openId = id;
}

/** Sau khi nối lại hoặc khi socket không dùng được: lấy lại hộp thư và các tin mới của hội thoại đang mở. */
export async function resync(): Promise<void> {
    await Promise.allSettled([
        refreshUnread(),
        loadConversations(true),
        openId ? syncThread(openId) : Promise.resolve(),
    ]);
}

// --- Sự kiện realtime -----------------------------------------------------

function handleEvent(name: ServerEvent, raw: unknown): void {
    const payload = raw as Record<string, unknown>;
    const me = viewer();
    switch (name) {
        case "message.created": {
            const data = payload as unknown as MessageCreatedPayload;
            let unknown = false;
            messagingStore.update((state) => {
                const result = applyMessageCreated(state, data, me, openId);
                unknown = result.unknown;
                return result.state;
            });
            if (unknown) void fetchConversation(data.conversationId);
            if (data.message.senderId !== me) setTyping(data.conversationId, 0);
            if (data.message.senderId !== me && openId === data.conversationId) {
                scheduleRead(data.conversationId);
            }
            scheduleUnread();
            break;
        }
        case "message.updated":
            messagingStore.update((state) =>
                applyMessageUpdated(state, payload as { conversationId: string; seq: number }),
            );
            scheduleUnread();
            break;
        case "reaction.changed":
            messagingStore.update((state) =>
                applyReaction(
                    state,
                    payload as {
                        conversationId: string;
                        seq: number;
                        userId: string;
                        emoji: string | null;
                        previousEmoji?: string | null;
                    },
                    me,
                ),
            );
            break;
        case "conversation.read":
            messagingStore.update((state) =>
                applyRead(
                    state,
                    payload as { conversationId: string; userId: string; lastReadSeq: number },
                    me,
                ),
            );
            break;
        case "conversation.updated": {
            const id = payload.conversationId as string | null;
            const reason = payload.reason as string;
            if (!id) break;
            if (reason === "accepted") void fetchConversation(id);
            else if (reason === "declined" || reason === "deleted_by_me" || reason === "blocked") {
                messagingStore.update((state) => removeConversation(state, id));
            }
            scheduleUnread();
            break;
        }
        case "typing": {
            const id = payload.conversationId as string;
            if (payload.active === false) setTyping(id, 0);
            else setTyping(id, Date.now() + TYPING_VISIBLE_MS);
            break;
        }
        case "unread.changed":
            scheduleUnread();
            break;
    }
}

function setTyping(conversationId: string, until: number): void {
    messagingStore.update((state) => ({
        ...state,
        typing: { ...state.typing, [conversationId]: until },
    }));
    const previous = typingTimers.get(conversationId);
    if (previous) clearTimeout(previous);
    if (until > 0) {
        typingTimers.set(
            conversationId,
            setTimeout(() => setTyping(conversationId, 0), TYPING_VISIBLE_MS + 100),
        );
    }
}

function scheduleUnread(): void {
    if (unreadTimer) clearTimeout(unreadTimer);
    unreadTimer = setTimeout(() => void refreshUnread(), 400);
}

export async function refreshUnread(): Promise<void> {
    try {
        const unread = await api.getUnreadCount();
        messagingStore.update((state) => ({ ...state, unread }));
    } catch {
        /* giữ số cũ */
    }
}

// --- Hộp thư --------------------------------------------------------------

export async function loadConversations(silent = false): Promise<void> {
    try {
        const [inbox, requests] = await Promise.all([
            api.listConversations("inbox"),
            api.listConversations("requests"),
        ]);
        messagingStore.update((state) => {
            const fetched = { inbox: inbox, requests: requests };
            const ids = new Set([...inbox.items, ...requests.items].map((item) => item.id));
            const conversations = { ...upsertConversations(state, [...inbox.items, ...requests.items]).conversations };
            // Hội thoại đã có trong kho nhưng không còn trong trang tải về: bỏ nếu trang đó đã đủ
            // hoặc nó mới hơn mục cũ nhất của trang (nghĩa là đã bị xóa, ẩn hoặc chuyển thư mục).
            for (const item of Object.values(conversations)) {
                if (ids.has(item.id)) continue;
                const page = inFolder(item, "requests") ? fetched.requests : fetched.inbox;
                const oldest = page.items.at(-1)?.lastMessageAt ?? "";
                if (!page.nextCursor || (item.lastMessageAt ?? "") >= oldest) delete conversations[item.id];
            }
            return {
                ...state,
                conversations,
                listLoaded: true,
                listError: "",
                cursors: { inbox: inbox.nextCursor, requests: requests.nextCursor },
            };
        });
    } catch (error) {
        if (!silent) {
            messagingStore.update((state) => ({
                ...state,
                listLoaded: true,
                listError: errorText(error, "Không tải được tin nhắn."),
            }));
        }
    }
}

export async function loadMoreConversations(folder: "inbox" | "requests"): Promise<void> {
    const cursor = messagingStore.getState().cursors[folder];
    if (!cursor) return;
    try {
        const page = await api.listConversations(folder, { cursor });
        messagingStore.update((state) => ({
            ...upsertConversations(state, page.items),
            cursors: { ...state.cursors, [folder]: page.nextCursor },
        }));
    } catch {
        /* giữ nguyên, người dùng cuộn lại để thử */
    }
}

async function fetchConversation(id: string): Promise<void> {
    try {
        const detail = await api.getConversation(id);
        messagingStore.update((state) => {
            const next = upsertConversations(state, [toSummary(detail)]);
            return state.threads[id] ? withThread(next, id, { detail }) : next;
        });
    } catch {
        /* sẽ có ở lần tải hộp thư kế tiếp */
    }
}

// --- Hội thoại đang mở ----------------------------------------------------

export async function openThread(id: string): Promise<void> {
    messagingStore.update((state) => withThread(state, id, { error: "" }));
    try {
        const [detail, page] = await Promise.all([api.getConversation(id), api.listMessages(id)]);
        messagingStore.update((state) =>
            withThread(upsertConversations(state, [toSummary(detail)]), id, (thread) => ({
                detail,
                messages: mergeMessages(thread.messages, page.items),
                hasMoreBefore: thread.loaded ? thread.hasMoreBefore : page.hasMoreBefore,
                peerLastReadSeq: page.peerLastReadSeq,
                loaded: true,
                error: "",
            })),
        );
        scheduleRead(id);
    } catch (error) {
        messagingStore.update((state) =>
            withThread(state, id, {
                loaded: true,
                error:
                    error instanceof AuthApiError && error.status === 404
                        ? "Không tìm thấy hội thoại."
                        : errorText(error, "Không tải được hội thoại."),
            }),
        );
    }
}

export async function syncThread(id: string): Promise<void> {
    const thread = getThread(messagingStore.getState(), id);
    if (!thread.loaded) return openThread(id);
    try {
        let after = thread.messages.at(-1)?.seq ?? 0;
        for (let guard = 0; guard < 20; guard += 1) {
            const page = await api.listMessages(id, { afterSeq: after, limit: 100 });
            messagingStore.update((state) =>
                withThread(state, id, (current) => ({
                    messages: mergeMessages(current.messages, page.items),
                    peerLastReadSeq: page.peerLastReadSeq,
                })),
            );
            after = page.items.at(-1)?.seq ?? after;
            if (!page.hasMoreAfter || !page.items.length) break;
        }
        await fetchConversation(id);
        scheduleRead(id);
    } catch {
        /* thử lại ở lần đồng bộ sau */
    }
}

export async function loadOlder(id: string): Promise<void> {
    const thread = getThread(messagingStore.getState(), id);
    const first = thread.messages[0];
    if (!first || !thread.hasMoreBefore || thread.loadingOlder) return;
    messagingStore.update((state) => withThread(state, id, { loadingOlder: true }));
    try {
        const page = await api.listMessages(id, { beforeSeq: first.seq });
        messagingStore.update((state) =>
            withThread(state, id, (current) => ({
                messages: mergeMessages(current.messages, page.items),
                hasMoreBefore: page.hasMoreBefore,
                loadingOlder: false,
            })),
        );
    } catch {
        messagingStore.update((state) => withThread(state, id, { loadingOlder: false }));
    }
}

export async function refreshDetail(id: string): Promise<void> {
    await fetchConversation(id);
}

// --- Đã đọc ---------------------------------------------------------------

export function scheduleRead(id: string): void {
    const previous = readTimers.get(id);
    if (previous) clearTimeout(previous);
    readTimers.set(
        id,
        setTimeout(() => {
            readTimers.delete(id);
            void markReadNow(id);
        }, 300),
    );
}

async function markReadNow(id: string): Promise<void> {
    if (openId !== id || document.visibilityState !== "visible") return;
    const state = messagingStore.getState();
    const conversation = state.conversations[id];
    if (!conversation) return;
    const thread = getThread(state, id);
    const newest = Math.max(conversation.lastSeq, thread.messages.at(-1)?.seq ?? 0);
    if (newest <= conversation.lastReadSeq) return;
    messagingStore.update((current) =>
        applyRead(current, { conversationId: id, userId: viewer(), lastReadSeq: newest }, viewer()),
    );
    try {
        await api.markRead(id, newest);
        scheduleUnread();
    } catch {
        /* lần sau sẽ gửi lại */
    }
}

// --- Gửi tin --------------------------------------------------------------

export interface SendRequest {
    kind: "text" | "image" | "post_share";
    body: string;
    replyToSeq: number | null;
    files?: File[];
    postId?: string | null;
}

export function sendMessage(conversationId: string, request: SendRequest): void {
    const files = request.files ?? [];
    const pending: PendingMessage = {
        clientMsgId: crypto.randomUUID(),
        conversationId,
        kind: request.kind,
        body: request.body,
        replyToSeq: request.replyToSeq,
        files,
        previews: files.map((file) => URL.createObjectURL(file)),
        postId: request.postId ?? null,
        status: "sending",
        error: "",
        createdAt: new Date().toISOString(),
    };
    messagingStore.update((state) =>
        withThread(state, conversationId, (thread) => ({ pending: [...thread.pending, pending] })),
    );
    void performSend(pending);
}

export function retryPending(conversationId: string, clientMsgId: string): void {
    const pending = getThread(messagingStore.getState(), conversationId).pending.find(
        (item) => item.clientMsgId === clientMsgId,
    );
    if (!pending) return;
    updatePending(conversationId, clientMsgId, { status: "sending", error: "" });
    void performSend({ ...pending, status: "sending", error: "" });
}

export function discardPending(conversationId: string, clientMsgId: string): void {
    const pending = getThread(messagingStore.getState(), conversationId).pending.find(
        (item) => item.clientMsgId === clientMsgId,
    );
    pending?.previews.forEach((url) => URL.revokeObjectURL(url));
    messagingStore.update((state) =>
        withThread(state, conversationId, (thread) => ({
            pending: thread.pending.filter((item) => item.clientMsgId !== clientMsgId),
        })),
    );
}

function updatePending(conversationId: string, clientMsgId: string, patch: Partial<PendingMessage>): void {
    messagingStore.update((state) =>
        withThread(state, conversationId, (thread) => ({
            pending: thread.pending.map((item) =>
                item.clientMsgId === clientMsgId ? { ...item, ...patch } : item,
            ),
        })),
    );
}

async function performSend(pending: PendingMessage): Promise<void> {
    const { conversationId, clientMsgId } = pending;
    try {
        let attachmentIds: string[] | undefined;
        if (pending.kind === "image") {
            attachmentIds = [];
            for (const file of pending.files) attachmentIds.push(await api.uploadImage(conversationId, file));
        }
        const message = await api.sendMessage(conversationId, {
            clientMsgId,
            kind: pending.kind,
            body: pending.body || undefined,
            replyToSeq: pending.replyToSeq ?? undefined,
            attachmentIds,
            postId: pending.postId ?? undefined,
        });
        confirmSent(conversationId, clientMsgId, message, pending.previews);
    } catch (error) {
        updatePending(conversationId, clientMsgId, {
            status: "failed",
            error: errorText(error, "Chưa gửi được."),
        });
        void fetchConversation(conversationId);
    }
}

function confirmSent(conversationId: string, clientMsgId: string, message: Message, previews: string[]): void {
    previews.forEach((url) => URL.revokeObjectURL(url));
    messagingStore.update((state) => {
        const thread = getThread(state, conversationId);
        let next = withThread(state, conversationId, {
            messages: mergeMessages(thread.messages, [message]),
            pending: thread.pending.filter((item) => item.clientMsgId !== clientMsgId),
        });
        const known = next.conversations[conversationId];
        if (known && message.seq >= known.lastSeq) {
            next = {
                ...next,
                conversations: {
                    ...next.conversations,
                    [conversationId]: {
                        ...known,
                        lastSeq: message.seq,
                        lastReadSeq: message.seq,
                        unread: false,
                        lastMessagePreview: previewOf(message),
                        lastMessageAt: message.createdAt,
                        lastSenderIsMe: true,
                    },
                },
            };
        }
        return next;
    });
}

// --- Tin đã gửi -----------------------------------------------------------

export async function unsend(conversationId: string, message: Message): Promise<void> {
    messagingStore.update((state) =>
        applyMessageUpdated(state, { conversationId, seq: message.seq }),
    );
    try {
        await api.unsendMessage(conversationId, message.id);
    } catch (error) {
        void syncThread(conversationId);
        throw error;
    }
}

export async function toggleReaction(conversationId: string, message: Message, emoji: string): Promise<void> {
    const mine = message.reactions.find((item) => item.mine)?.emoji ?? null;
    const next = mine === emoji ? null : emoji;
    messagingStore.update((state) =>
        applyReaction(
            state,
            { conversationId, seq: message.seq, userId: viewer(), emoji: next },
            viewer(),
        ),
    );
    try {
        if (next) await api.reactToMessage(conversationId, message.id, next);
        else await api.removeReaction(conversationId, message.id);
    } catch (error) {
        messagingStore.update((state) =>
            applyReaction(
                state,
                { conversationId, seq: message.seq, userId: viewer(), emoji: mine },
                viewer(),
            ),
        );
        throw error;
    }
}

// --- Hội thoại ------------------------------------------------------------

export async function startConversation(userId: string): Promise<string> {
    const detail = await api.openConversation(userId);
    messagingStore.update((state) =>
        detail.lastSeq > 0 ? upsertConversations(state, [toSummary(detail)]) : state,
    );
    return detail.id;
}

export async function acceptRequest(id: string): Promise<void> {
    const detail = await api.acceptConversation(id);
    messagingStore.update((state) =>
        withThread(upsertConversations(state, [toSummary(detail)]), id, { detail }),
    );
    scheduleUnread();
}

export async function declineRequest(id: string): Promise<void> {
    await api.declineConversation(id);
    messagingStore.update((state) => removeConversation(state, id));
    scheduleUnread();
}

export async function deleteForMe(id: string): Promise<void> {
    await api.deleteConversation(id);
    messagingStore.update((state) => removeConversation(state, id));
    scheduleUnread();
}

export async function muteConversation(id: string, until: string | null): Promise<void> {
    await api.muteConversation(id, until);
    messagingStore.update((state) => {
        const conversation = state.conversations[id];
        if (!conversation) return state;
        const muted = Boolean(until && new Date(until).getTime() > Date.now());
        return {
            ...state,
            conversations: { ...state.conversations, [id]: { ...conversation, muted } },
        };
    });
    scheduleUnread();
}

export async function blockPerson(conversationId: string | null, userId: string): Promise<void> {
    await api.blockUser(userId);
    if (conversationId) messagingStore.update((state) => removeConversation(state, conversationId));
    scheduleUnread();
}

export async function unblockPerson(conversationId: string | null, userId: string): Promise<void> {
    await api.unblockUser(userId);
    if (conversationId) await fetchConversation(conversationId);
}

// --- Đang gõ --------------------------------------------------------------

export function notifyTyping(conversationId: string): void {
    const now = Date.now();
    if (now - (lastTypingSent.get(conversationId) ?? 0) < TYPING_THROTTLE_MS) return;
    lastTypingSent.set(conversationId, now);
    realtime.sendTyping(conversationId, true);
}

export function stopTyping(conversationId: string): void {
    if (!lastTypingSent.has(conversationId)) return;
    lastTypingSent.delete(conversationId);
    realtime.sendTyping(conversationId, false);
}
