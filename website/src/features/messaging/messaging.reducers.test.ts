import { describe, expect, it } from "vitest";

import {
    applyMessageCreated,
    applyMessageUpdated,
    applyReaction,
    applyRead,
    initialState,
    mergeMessages,
    selectFolder,
    upsertConversations,
    withThread,
} from "./messaging.reducers";
import type { ConversationSummary, Message } from "./messaging.types";

const ME = "me";

function message(seq: number, extra: Partial<Message> = {}): Message {
    return {
        id: `m${seq}`,
        conversationId: "c1",
        seq,
        senderId: "peer",
        kind: "text",
        body: `tin ${seq}`,
        status: "visible",
        clientMsgId: null,
        replyTo: null,
        attachments: [],
        sharedPost: null,
        reactions: [],
        createdAt: new Date(2026, 10, 2, 10, seq).toISOString(),
        ...extra,
    };
}

function conversation(extra: Partial<ConversationSummary> = {}): ConversationSummary {
    return {
        id: "c1",
        type: "direct",
        state: "active",
        peer: { id: "peer", displayName: "Lan", avatarUrl: null },
        lastSeq: 3,
        lastReadSeq: 3,
        unread: false,
        muted: false,
        lastMessagePreview: "tin 3",
        lastMessageAt: new Date(2026, 10, 2, 10, 3).toISOString(),
        lastSenderIsMe: false,
        iAmInitiator: false,
        ...extra,
    };
}

describe("mergeMessages", () => {
    it("sắp theo seq, bỏ trùng, tin mới ghi đè", () => {
        const merged = mergeMessages([message(1), message(3)], [message(2), message(3, { body: "sửa" })]);
        expect(merged.map((item) => item.seq)).toEqual([1, 2, 3]);
        expect(merged[2]?.body).toBe("sửa");
    });
    it("giữ clientMsgId của người gửi khi sự kiện trả về null", () => {
        const merged = mergeMessages([message(1, { clientMsgId: "abc" })], [message(1)]);
        expect(merged[0]?.clientMsgId).toBe("abc");
    });
});

describe("applyMessageCreated", () => {
    it("thêm vào thread đã mở, gỡ tin đang gửi cùng clientMsgId, tăng chưa đọc", () => {
        let state = upsertConversations(initialState(), [conversation()]);
        state = withThread(state, "c1", {
            loaded: true,
            messages: [message(3)],
            pending: [
                {
                    clientMsgId: "k1",
                    conversationId: "c1",
                    kind: "text",
                    body: "x",
                    replyToSeq: null,
                    files: [],
                    previews: [],
                    postId: null,
                    status: "sending",
                    error: "",
                    createdAt: "",
                },
            ],
        });
        const result = applyMessageCreated(
            state,
            { conversationId: "c1", message: message(4, { senderId: ME, clientMsgId: "k1" }) },
            ME,
            null,
        );
        expect(result.unknown).toBe(false);
        expect(result.state.threads.c1?.pending).toHaveLength(0);
        expect(result.state.threads.c1?.messages.map((item) => item.seq)).toEqual([3, 4]);
        expect(result.state.conversations.c1?.lastSeq).toBe(4);
        expect(result.state.conversations.c1?.unread).toBe(false);

        const incoming = applyMessageCreated(state, { conversationId: "c1", message: message(4) }, ME, null);
        expect(incoming.state.conversations.c1?.unread).toBe(true);
        expect(incoming.state.conversations.c1?.lastMessagePreview).toBe("tin 4");
    });
    it("báo hội thoại chưa biết", () => {
        const result = applyMessageCreated(initialState(), { conversationId: "zz", message: message(1) }, ME, null);
        expect(result.unknown).toBe(true);
    });
});

describe("applyMessageUpdated", () => {
    it("tin bị thu hồi mất nội dung, preview đổi nếu là tin cuối", () => {
        let state = upsertConversations(initialState(), [conversation()]);
        state = withThread(state, "c1", { loaded: true, messages: [message(2), message(3)] });
        state = applyMessageUpdated(state, { conversationId: "c1", seq: 3 });
        expect(state.threads.c1?.messages[1]).toMatchObject({ status: "deleted", body: "" });
        expect(state.conversations.c1?.lastMessagePreview).toBe("Tin nhắn đã thu hồi");
        state = applyMessageUpdated(state, { conversationId: "c1", seq: 2 });
        expect(state.conversations.c1?.lastMessagePreview).toBe("Tin nhắn đã thu hồi");
    });
});

describe("applyReaction", () => {
    const base = () => withThread(initialState(), "c1", { loaded: true, messages: [message(1)] });
    it("chính mình: đặt, đổi, bỏ và idempotent", () => {
        let state = applyReaction(base(), { conversationId: "c1", seq: 1, userId: ME, emoji: "❤️" }, ME);
        state = applyReaction(state, { conversationId: "c1", seq: 1, userId: ME, emoji: "❤️" }, ME);
        expect(state.threads.c1?.messages[0]?.reactions).toEqual([{ emoji: "❤️", count: 1, mine: true }]);
        state = applyReaction(state, { conversationId: "c1", seq: 1, userId: ME, emoji: "👍" }, ME);
        expect(state.threads.c1?.messages[0]?.reactions).toEqual([{ emoji: "👍", count: 1, mine: true }]);
        state = applyReaction(state, { conversationId: "c1", seq: 1, userId: ME, emoji: null }, ME);
        expect(state.threads.c1?.messages[0]?.reactions).toEqual([]);
    });
    it("người khác: trừ cảm xúc cũ theo previousEmoji", () => {
        let state = applyReaction(base(), { conversationId: "c1", seq: 1, userId: "peer", emoji: "😂" }, ME);
        state = applyReaction(state, { conversationId: "c1", seq: 1, userId: "peer", emoji: "🙏", previousEmoji: "😂" }, ME);
        expect(state.threads.c1?.messages[0]?.reactions).toEqual([{ emoji: "🙏", count: 1, mine: false }]);
    });
});

describe("applyRead", () => {
    it("của mình xóa chấm chưa đọc; của người kia cập nhật peerLastReadSeq và chỉ tăng", () => {
        let state = upsertConversations(initialState(), [conversation({ lastSeq: 5, lastReadSeq: 2, unread: true })]);
        state = applyRead(state, { conversationId: "c1", userId: ME, lastReadSeq: 5 }, ME);
        expect(state.conversations.c1?.unread).toBe(false);
        state = withThread(state, "c1", { loaded: true, peerLastReadSeq: 4 });
        state = applyRead(state, { conversationId: "c1", userId: "peer", lastReadSeq: 3 }, ME);
        expect(state.threads.c1?.peerLastReadSeq).toBe(4);
        state = applyRead(state, { conversationId: "c1", userId: "peer", lastReadSeq: 5 }, ME);
        expect(state.threads.c1?.peerLastReadSeq).toBe(5);
    });
});

describe("selectFolder", () => {
    it("tách Inbox và Requests, bỏ hội thoại rỗng, mới nhất trước", () => {
        const state = upsertConversations(initialState(), [
            conversation({ id: "a", lastMessageAt: "2026-11-02T10:00:00.000Z" }),
            conversation({ id: "b", lastMessageAt: "2026-11-02T11:00:00.000Z" }),
            conversation({ id: "req", state: "pending", iAmInitiator: false, lastMessageAt: "2026-11-02T09:00:00.000Z" }),
            conversation({ id: "mine", state: "pending", iAmInitiator: true, lastMessageAt: "2026-11-02T10:30:00.000Z" }),
            conversation({ id: "empty", lastSeq: 0 }),
        ]);
        expect(selectFolder(state, "inbox").map((item) => item.id)).toEqual(["b", "mine", "a"]);
        expect(selectFolder(state, "requests").map((item) => item.id)).toEqual(["req"]);
    });
});
