"use client";

import { ArrowDown, ArrowLeft, Ban, BellOff, Bell, Flag, MoreHorizontal, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";

import { useAuth } from "@/features/auth/use-auth";

import {
    acceptRequest,
    blockPerson,
    declineRequest,
    deleteForMe,
    discardPending,
    errorText,
    loadOlder,
    muteConversation,
    openThread,
    refreshDetail,
    retryPending,
    scheduleRead,
    setOpenConversation,
    syncThread,
    toggleReaction,
    unblockPerson,
    unsend,
} from "../messaging.actions";
import { LOAD_OLDER_PX, NEAR_BOTTOM_PX } from "../messaging.constants";
import { dayLabel, needsSeparator, presenceText, sameGroup } from "../messaging.format";
import { EMPTY_THREAD, type Message, type PendingMessage } from "../messaging.types";
import { useMessagingState } from "../messaging.store";
import { Composer } from "./composer";
import { Dialog } from "./dialog";
import { Lightbox } from "./lightbox";
import { MessageBubble } from "./message-bubble";
import { PersonAvatar } from "./person-avatar";
import { ReportDialog } from "./report-dialog";

const MUTE_OPTIONS: Array<{ label: string; hours: number | null }> = [
    { label: "1 giờ", hours: 1 },
    { label: "8 giờ", hours: 8 },
    { label: "24 giờ", hours: 24 },
    { label: "Cho đến khi bật lại", hours: null },
];

export function Thread({
    conversationId,
    root,
    onBack,
    onGone,
}: {
    conversationId: string;
    root: string;
    onBack: () => void;
    onGone: () => void;
}): JSX.Element {
    const auth = useAuth();
    const me = auth.user?.userId ?? "";
    const thread = useMessagingState((state) => state.threads[conversationId] ?? EMPTY_THREAD);
    const conversation = useMessagingState((state) => state.conversations[conversationId]);
    const typingUntil = useMessagingState((state) => state.typing[conversationId] ?? 0);
    const realtime = useMessagingState((state) => state.realtime);
    const detail = thread.detail;
    const peer = conversation?.peer ?? detail?.peer;

    const scroller = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const anchor = useRef<{ height: number; top: number } | null>(null);
    const lastKey = useRef("");
    const firstSeq = useRef<number | null>(null);
    const [newCount, setNewCount] = useState(0);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [reporting, setReporting] = useState<Message | null>(null);
    const [zoom, setZoom] = useState<{ message: Message; index: number } | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [muteOpen, setMuteOpen] = useState(false);
    const [confirm, setConfirm] = useState<"delete" | "block" | null>(null);
    const [notice, setNotice] = useState("");
    const [highlight, setHighlight] = useState<number | null>(null);
    const [divider, setDivider] = useState<number | null>(null);
    const menuBox = useRef<HTMLDivElement>(null);
    const initialScrolled = useRef(false);

    useEffect(() => {
        // Thread được dựng lại theo key=conversationId nên trạng thái cục bộ luôn mới.
        setOpenConversation(conversationId);
        void openThread(conversationId);
        return () => setOpenConversation(null);
    }, [conversationId]);

    useEffect(() => {
        function visible(): void {
            if (document.visibilityState === "visible") {
                scheduleRead(conversationId);
                void refreshDetail(conversationId);
            }
        }
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") void refreshDetail(conversationId);
        }, 60_000);
        document.addEventListener("visibilitychange", visible);
        window.addEventListener("focus", visible);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", visible);
            window.removeEventListener("focus", visible);
        };
    }, [conversationId]);

    useEffect(() => {
        if (realtime === "online" && thread.loaded) void syncThread(conversationId);
        // chỉ chạy khi socket vừa nối lại
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [realtime]);

    useEffect(() => {
        if (!menuOpen) return;
        function away(event: MouseEvent): void {
            if (event.target instanceof Node && !menuBox.current?.contains(event.target)) setMenuOpen(false);
        }
        window.addEventListener("mousedown", away);
        return () => window.removeEventListener("mousedown", away);
    }, [menuOpen]);

    useEffect(() => {
        if (!thread.loaded || divider !== null || initialScrolled.current) return;
        const read = conversation?.lastReadSeq ?? 0;
        const firstUnread = thread.messages.find((item) => item.seq > read && item.senderId !== me);
        setDivider(firstUnread ? firstUnread.seq : 0);
    }, [thread.loaded, thread.messages, conversation?.lastReadSeq, divider, me]);

    const scrollToBottom = useCallback((smooth = false): void => {
        const element = scroller.current;
        if (!element) return;
        element.scrollTo({ top: element.scrollHeight, behavior: smooth ? "smooth" : "auto" });
        atBottom.current = true;
        setNewCount(0);
    }, []);

    useLayoutEffect(() => {
        const element = scroller.current;
        if (!element || !thread.loaded) return;
        const first = thread.messages[0]?.seq ?? null;
        const last = thread.messages.at(-1);
        const pendingLast = thread.pending.at(-1);
        const key = `${last?.seq ?? 0}:${pendingLast?.clientMsgId ?? ""}:${thread.pending.length}`;

        if (!initialScrolled.current && divider !== null) {
            initialScrolled.current = true;
            const target = divider > 0 ? document.getElementById(`msg-${divider}`) : null;
            if (target) {
                target.scrollIntoView({ block: "center" });
                atBottom.current = false;
            } else {
                scrollToBottom();
            }
            lastKey.current = key;
            firstSeq.current = first;
            return;
        }
        if (anchor.current && firstSeq.current !== null && first !== null && first < firstSeq.current) {
            element.scrollTop = element.scrollHeight - anchor.current.height + anchor.current.top;
            anchor.current = null;
            firstSeq.current = first;
            return;
        }
        firstSeq.current = first;
        if (key === lastKey.current) return;
        lastKey.current = key;
        const mine = pendingLast ? true : last?.senderId === me;
        if (atBottom.current || mine) scrollToBottom();
        else setNewCount((count) => count + 1);
    }, [thread.messages, thread.pending, thread.loaded, divider, me, scrollToBottom]);

    function onScroll(): void {
        const element = scroller.current;
        if (!element) return;
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        atBottom.current = distance < NEAR_BOTTOM_PX;
        if (atBottom.current) setNewCount(0);
        if (element.scrollTop < LOAD_OLDER_PX && thread.hasMoreBefore && !thread.loadingOlder) {
            anchor.current = { height: element.scrollHeight, top: element.scrollTop };
            void loadOlder(conversationId);
        }
    }

    const stick = useCallback((): void => {
        if (atBottom.current) scrollToBottom();
    }, [scrollToBottom]);

    function jump(seq: number): void {
        const target = document.getElementById(`msg-${seq}`);
        if (!target) {
            setNotice("Tin này nằm ở phía trên. Hãy cuộn lên để tải thêm.");
            return;
        }
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        setHighlight(seq);
        setTimeout(() => setHighlight(null), 1200);
    }

    async function guarded(action: () => Promise<void>, ok = ""): Promise<void> {
        try {
            await action();
            setNotice(ok);
        } catch (error) {
            setNotice(errorText(error));
        }
    }

    const messages = thread.messages;
    const lastSeenMine = useMemo(() => {
        const read = thread.peerLastReadSeq;
        if (read === null) return null;
        const mine = messages.filter((item) => item.senderId === me && item.seq <= read && item.status === "visible");
        return mine.at(-1)?.seq ?? null;
    }, [messages, me, thread.peerLastReadSeq]);

    const peerName = peer?.displayName ?? "";
    const typing = typingUntil > 0;
    const status = presenceText(detail?.peerPresence ?? null);
    const requestForMe = detail?.state === "pending" && detail.iAmInitiator === false;
    const blocked = detail?.blockedByMe === true;
    const sendable = detail?.canSend === true;

    if (thread.error) {
        return (
            <section className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-4 bg-white p-6 text-center">
                <p role="alert" className="m-0">
                    {thread.error}
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green"
                        onClick={() => void openThread(conversationId)}
                    >
                        Thử lại
                    </button>
                    <button
                        type="button"
                        className="min-h-11 rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        onClick={onGone}
                    >
                        Về danh sách
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="relative flex h-full min-w-0 flex-1 flex-col bg-white" aria-label={peerName ? `Hội thoại với ${peerName}` : "Hội thoại"}>
            <header className="flex min-h-[72px] items-center gap-3 border-b border-charcoal/10 px-3 sm:px-5">
                <button
                    type="button"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-cream focus-visible:outline-2 focus-visible:outline-green md:hidden"
                    aria-label="Quay lại danh sách"
                    onClick={onBack}
                >
                    <ArrowLeft className="size-5" aria-hidden="true" />
                </button>
                {peer ? <PersonAvatar name={peer.displayName} url={peer.avatarUrl} size={44} /> : <span className="size-11 rounded-full bg-cream" />}
                <div className="min-w-0 flex-1">
                    <h1 className="m-0 truncate text-base font-semibold">{peerName || "Đang tải…"}</h1>
                    <p className="m-0 flex items-center gap-1.5 truncate text-xs text-charcoal/65" aria-live="off">
                        {detail?.peerPresence?.online ? <span className="size-2 rounded-full bg-green" aria-hidden="true" /> : null}
                        {status}
                    </p>
                </div>
                <div className="relative" ref={menuBox}>
                    <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                        aria-label="Tùy chọn hội thoại"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((current) => !current)}
                    >
                        <MoreHorizontal className="size-5" aria-hidden="true" />
                    </button>
                    {menuOpen ? (
                        <div className="absolute right-0 z-30 w-60 rounded-2xl border border-charcoal/10 bg-white p-1.5 shadow-md" role="menu">
                            <HeaderItem
                                icon={conversation?.muted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                                label={conversation?.muted ? "Bật lại thông báo" : "Tắt thông báo"}
                                onClick={() => {
                                    setMenuOpen(false);
                                    if (conversation?.muted) void guarded(() => muteConversation(conversationId, null), "Đã bật lại thông báo.");
                                    else setMuteOpen(true);
                                }}
                            />
                            {blocked ? (
                                <HeaderItem
                                    icon={<Ban className="size-4" />}
                                    label="Bỏ chặn"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        if (peer) void guarded(() => unblockPerson(conversationId, peer.id), "Đã bỏ chặn.");
                                    }}
                                />
                            ) : (
                                <HeaderItem
                                    icon={<Ban className="size-4" />}
                                    label="Chặn"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        setConfirm("block");
                                    }}
                                />
                            )}
                            <HeaderItem
                                icon={<Trash2 className="size-4" />}
                                label="Xóa hội thoại"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setConfirm("delete");
                                }}
                            />
                        </div>
                    ) : null}
                </div>
            </header>

            {realtime === "offline" || realtime === "connecting" ? (
                <p role="status" className="m-0 bg-cream px-4 py-1.5 text-center text-xs text-charcoal/75">
                    {realtime === "connecting" ? "Đang kết nối lại…" : "Không có kết nối. Tin mới sẽ được tải khi có mạng."}
                </p>
            ) : null}
            {notice ? (
                <p role="status" className="m-0 flex items-center justify-between gap-3 bg-green/10 px-4 py-2 text-sm">
                    <span>{notice}</span>
                    <button type="button" className="font-semibold underline focus-visible:outline-2 focus-visible:outline-green" onClick={() => setNotice("")}>
                        Ẩn
                    </button>
                </p>
            ) : null}

            <div
                ref={scroller}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-label="Tin nhắn"
                className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
                onScroll={onScroll}
            >
                {!thread.loaded ? (
                    <div className="grid gap-3" aria-hidden="true">
                        {[0, 1, 2, 3].map((index) => (
                            <div key={index} className={`h-10 animate-pulse rounded-2xl bg-cream ${index % 2 ? "ml-auto w-1/2" : "w-2/5"}`} />
                        ))}
                    </div>
                ) : (
                    <>
                        {thread.loadingOlder ? <p className="m-0 mb-2 text-center text-xs text-charcoal/60">Đang tải tin cũ hơn…</p> : null}
                        {!thread.hasMoreBefore && messages.length === 0 && thread.pending.length === 0 ? (
                            <div className="grid place-items-center gap-2 py-16 text-center text-charcoal/70">
                                {peer ? <PersonAvatar name={peer.displayName} url={peer.avatarUrl} size={72} /> : null}
                                <p className="m-0 font-semibold">{peerName}</p>
                                <p className="m-0 text-sm">Chưa có tin nhắn nào. Hãy gửi lời chào.</p>
                            </div>
                        ) : null}
                        {messages.map((message, index) => {
                            const previous = messages[index - 1];
                            const next = messages[index + 1];
                            const separator = needsSeparator(previous?.createdAt, message.createdAt);
                            const grouped = !separator && sameGroup(previous, message);
                            const groupedNext = Boolean(
                                next && !needsSeparator(message.createdAt, next.createdAt) && sameGroup(message, next) && divider !== next.seq,
                            );
                            const mine = message.senderId === me;
                            return (
                                <div key={message.seq}>
                                    {separator ? (
                                        <p className="m-0 mt-4 mb-1 text-center text-xs text-charcoal/55">{dayLabel(message.createdAt)}</p>
                                    ) : null}
                                    {divider && divider === message.seq && !mine ? (
                                        <div className="my-3 flex items-center gap-3 text-xs font-semibold text-green" role="separator" aria-label="Tin mới">
                                            <span className="h-px flex-1 bg-green/40" />
                                            Tin mới
                                            <span className="h-px flex-1 bg-green/40" />
                                        </div>
                                    ) : null}
                                    <MessageBubble
                                        message={message}
                                        mine={mine}
                                        peerName={peerName}
                                        groupedWithPrevious={grouped}
                                        groupedWithNext={groupedNext}
                                        highlighted={highlight === message.seq}
                                        root={root}
                                        onReply={setReplyTo}
                                        onReact={(target, emoji) => void guarded(() => toggleReaction(conversationId, target, emoji))}
                                        onUnsend={(target) => void guarded(() => unsend(conversationId, target))}
                                        onReport={setReporting}
                                        onJump={jump}
                                        onMedia={stick}
                                        onZoom={(target, at) => setZoom({ message: target, index: at })}
                                    />
                                    {lastSeenMine === message.seq ? (
                                        <p className="m-0 mt-0.5 text-right text-[11px] text-charcoal/55">Đã xem</p>
                                    ) : null}
                                </div>
                            );
                        })}
                        {thread.pending.map((item) => (
                            <PendingBubble key={item.clientMsgId} item={item} conversationId={conversationId} />
                        ))}
                        {typing ? (
                            <p className="m-0 mt-3 text-xs text-charcoal/60" role="status">
                                <span className="inline-flex items-center gap-1" aria-label={`${peerName} đang soạn tin`}>
                                    <span className="size-1.5 animate-bounce rounded-full bg-charcoal/50 motion-reduce:animate-none" />
                                    <span className="size-1.5 animate-bounce rounded-full bg-charcoal/50 [animation-delay:120ms] motion-reduce:animate-none" />
                                    <span className="size-1.5 animate-bounce rounded-full bg-charcoal/50 [animation-delay:240ms] motion-reduce:animate-none" />
                                </span>
                            </p>
                        ) : null}
                    </>
                )}
            </div>

            {newCount > 0 ? (
                <button
                    type="button"
                    className="absolute bottom-28 left-1/2 z-20 inline-flex min-h-10 -translate-x-1/2 items-center gap-1 rounded-full bg-charcoal px-4 text-sm font-semibold text-cream shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={() => scrollToBottom(true)}
                >
                    <ArrowDown className="size-4" aria-hidden="true" />
                    Tin mới ({newCount})
                </button>
            ) : null}

            {requestForMe && peer ? (
                <RequestBar
                    name={peer.displayName}
                    onAccept={() => void guarded(() => acceptRequest(conversationId))}
                    onDecline={() => void guarded(async () => { await declineRequest(conversationId); onGone(); })}
                    onBlock={() => setConfirm("block")}
                    onReport={() => {
                        const last = [...messages].reverse().find((item) => item.senderId !== me && item.status === "visible");
                        if (last) setReporting(last);
                    }}
                />
            ) : sendable ? (
                <Composer
                    key={conversationId}
                    conversationId={conversationId}
                    replyTo={replyTo}
                    replyName={replyTo ? (replyTo.senderId === me ? "chính bạn" : peerName) : ""}
                    onClearReply={() => setReplyTo(null)}
                    onSent={() => scrollToBottom()}
                />
            ) : (
                <div className="border-t border-charcoal/10 px-4 py-4 text-center text-sm text-charcoal/75">
                    {!detail ? null : blocked ? (
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <span>Bạn đã chặn người này.</span>
                            <button
                                type="button"
                                className="min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green"
                                onClick={() => peer && void guarded(() => unblockPerson(conversationId, peer.id), "Đã bỏ chặn.")}
                            >
                                Bỏ chặn
                            </button>
                        </div>
                    ) : detail.state !== "active" && detail.iAmInitiator ? (
                        "Bạn có thể nhắn thêm sau khi người này chấp nhận."
                    ) : (
                        "Bạn không thể nhắn tin cho người này."
                    )}
                </div>
            )}

            {muteOpen ? (
                <Dialog title="Tắt thông báo" onClose={() => setMuteOpen(false)}>
                    <ul className="m-0 grid gap-1 p-0">
                        {MUTE_OPTIONS.map((option) => (
                            <li key={option.label} className="list-none">
                                <button
                                    type="button"
                                    className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                                    onClick={() => {
                                        setMuteOpen(false);
                                        const until = option.hours
                                            ? new Date(Date.now() + option.hours * 3_600_000).toISOString()
                                            : "9999-12-31T00:00:00.000Z";
                                        void guarded(() => muteConversation(conversationId, until), "Đã tắt thông báo.");
                                    }}
                                >
                                    {option.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </Dialog>
            ) : null}
            {confirm ? (
                <Dialog title={confirm === "delete" ? "Xóa hội thoại?" : `Chặn ${peerName}?`} onClose={() => setConfirm(null)}>
                    <p className="m-0 text-sm text-charcoal/80">
                        {confirm === "delete"
                            ? "Hội thoại chỉ bị xóa phía bạn. Người kia vẫn giữ tin nhắn. Tin mới sẽ làm hội thoại hiện lại, chỉ từ tin mới."
                            : "Người này sẽ không nhắn được cho bạn và không biết mình bị chặn. Bạn có thể bỏ chặn trong cài đặt."}
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            className="min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green"
                            onClick={() => setConfirm(null)}
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            className="min-h-11 rounded-full bg-charcoal px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                            onClick={() => {
                                const action = confirm;
                                setConfirm(null);
                                void guarded(async () => {
                                    if (action === "delete") await deleteForMe(conversationId);
                                    else if (peer) await blockPerson(conversationId, peer.id);
                                    onGone();
                                });
                            }}
                        >
                            {confirm === "delete" ? "Xóa" : "Chặn"}
                        </button>
                    </div>
                </Dialog>
            ) : null}
            {reporting ? (
                <ReportDialog
                    conversationId={conversationId}
                    message={reporting}
                    onClose={() => setReporting(null)}
                    onDone={(text) => {
                        setReporting(null);
                        setNotice(text);
                    }}
                />
            ) : null}
            {zoom ? <Lightbox files={zoom.message.attachments} start={zoom.index} onClose={() => setZoom(null)} /> : null}
        </section>
    );
}

function HeaderItem({ icon, label, onClick }: { icon: JSX.Element; label: string; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
            onClick={onClick}
        >
            {icon}
            {label}
        </button>
    );
}

function PendingBubble({ item, conversationId }: { item: PendingMessage; conversationId: string }): JSX.Element {
    const failed = item.status === "failed";
    return (
        <div className="mt-3 flex flex-col items-end">
            <div
                className={`max-w-[min(70vw,34rem)] rounded-2xl px-3.5 py-2 text-[15px] leading-snug text-cream ${failed ? "border-2 border-red-700 bg-green/70" : "bg-green opacity-60"}`}
            >
                {item.previews.length > 0 ? (
                    <div className={`mb-1 grid gap-1 ${item.previews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {item.previews.map((url, index) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt={`Ảnh đang gửi ${index + 1}`} className="max-h-48 w-full rounded-xl object-cover" />
                        ))}
                    </div>
                ) : null}
                {item.body ? <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{item.body}</p> : null}
            </div>
            {failed ? (
                <p className="m-0 mt-1 flex flex-wrap items-center justify-end gap-2 text-xs text-red-700" role="alert">
                    <span>{item.error || "Chưa gửi được."}</span>
                    <button
                        type="button"
                        className="min-h-9 font-semibold underline focus-visible:outline-2 focus-visible:outline-green"
                        onClick={() => retryPending(conversationId, item.clientMsgId)}
                    >
                        Gửi lại
                    </button>
                    <button
                        type="button"
                        className="min-h-9 font-semibold underline focus-visible:outline-2 focus-visible:outline-green"
                        onClick={() => discardPending(conversationId, item.clientMsgId)}
                    >
                        Xóa
                    </button>
                </p>
            ) : (
                <p className="m-0 mt-1 text-[11px] text-charcoal/55">Đang gửi…</p>
            )}
        </div>
    );
}

function RequestBar({
    name,
    onAccept,
    onDecline,
    onBlock,
    onReport,
}: {
    name: string;
    onAccept: () => void;
    onDecline: () => void;
    onBlock: () => void;
    onReport: () => void;
}): JSX.Element {
    return (
        <div className="border-t border-charcoal/10 bg-cream px-4 py-4 text-center">
            <p className="m-0 text-sm">
                <strong>{name}</strong> muốn nhắn tin cho bạn. Họ chỉ nhắn thêm được sau khi bạn chấp nhận.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                    type="button"
                    className="min-h-11 rounded-full bg-green px-6 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={onAccept}
                >
                    Chấp nhận
                </button>
                <button
                    type="button"
                    className="min-h-11 rounded-full border border-charcoal/30 bg-white px-6 font-semibold focus-visible:outline-2 focus-visible:outline-green"
                    onClick={onDecline}
                >
                    Từ chối
                </button>
                <button
                    type="button"
                    className="min-h-11 rounded-full border border-charcoal/30 bg-white px-6 font-semibold focus-visible:outline-2 focus-visible:outline-green"
                    onClick={onBlock}
                >
                    Chặn
                </button>
            </div>
            <button
                type="button"
                className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm underline focus-visible:outline-2 focus-visible:outline-green"
                onClick={onReport}
            >
                <Flag className="size-4" aria-hidden="true" />
                Báo cáo
            </button>
        </div>
    );
}
