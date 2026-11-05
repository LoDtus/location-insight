"use client";

import { Ban, Bell, BellOff, Clock, EyeOff, Pencil, Pin, PinOff, Search, Trash2, X, type LucideIcon } from "lucide-react";
import { useState, type JSX, type ReactNode } from "react";

import { useAuth } from "@/features/auth/use-auth";

import {
    acceptHistoryDelete,
    blockPerson,
    cancelHistoryDelete,
    declineHistoryDelete,
    deleteForMe,
    errorText,
    jumpToMessage,
    muteConversation,
    requestHistoryDelete,
    setPinned,
    unblockPerson,
} from "../messaging.actions";
import { peerLabel, presenceText } from "../messaging.format";
import { useMessagingState } from "../messaging.store";
import { EMPTY_THREAD } from "../messaging.types";
import { ConfirmDialog } from "./confirm-dialog";
import { Dialog } from "./dialog";
import { IncomingDeleteDialog } from "./history-dialogs";
import { InfoSearch } from "./info-search";
import { SharedFull, SharedPreview, type SharedContext, type SharedTab } from "./info-shared";
import { NicknameDialog } from "./nickname-dialog";
import { PersonAvatar } from "./person-avatar";

const MUTE_OPTIONS: Array<{ label: string; hours: number | null }> = [
    { label: "1 giờ", hours: 1 },
    { label: "8 giờ", hours: 8 },
    { label: "24 giờ", hours: 24 },
    { label: "Cho đến khi bật lại", hours: null },
];

type View = { name: "main" } | { name: "search" } | { name: "shared"; tab: SharedTab };
type Modal = "mute" | "nickname" | "block" | "deleteMine" | "deleteBoth" | "incoming" | null;

/**
 * Cột thông tin của một hội thoại: người kia, thao tác nhanh (ghim, thông báo, tìm), ảnh/liên kết/tệp đã gửi
 * và các thao tác với cuộc trò chuyện. Dùng làm cột cố định trên màn rộng, và làm ngăn trượt trên màn nhỏ.
 */
export function ConversationInfoPanel({
    conversationId,
    variant,
    onClose,
    onGone,
}: {
    conversationId: string;
    variant: "column" | "sheet";
    onClose: () => void;
    onGone: () => void;
}): JSX.Element {
    const auth = useAuth();
    const me = auth.user?.userId ?? "";
    const conversation = useMessagingState((state) => state.conversations[conversationId]);
    const thread = useMessagingState((state) => state.threads[conversationId] ?? EMPTY_THREAD);
    const detail = thread.detail;
    const peer = conversation?.peer ?? detail?.peer;
    const [view, setView] = useState<View>({ name: "main" });
    const [modal, setModal] = useState<Modal>(null);
    const [notice, setNotice] = useState("");

    const realName = peer?.displayName ?? "";
    const name = conversation ? peerLabel(conversation) : realName;
    const nickname = conversation?.nickname ?? null;
    const muted = conversation?.muted === true;
    const pinned = conversation?.pinned === true;
    const blocked = detail?.blockedByMe === true;
    const inInbox = conversation ? conversation.state === "active" || conversation.iAmInitiator : false;
    const canDeleteBoth = conversation?.state === "active" && !blocked;
    const request = detail?.deleteRequest ?? null;
    const status = presenceText(detail?.peerPresence ?? null);

    const lastSeq = thread.messages.at(-1)?.seq ?? conversation?.lastSeq ?? 0;
    const unsent = thread.messages.filter((item) => item.status === "deleted").length;
    const context: SharedContext = {
        conversationId,
        version: `${lastSeq}:${unsent}`,
        me,
        peerName: name,
        onJump: (seq) => void jump(seq),
    };

    async function jump(seq: number): Promise<void> {
        setNotice("");
        const found = await jumpToMessage(conversationId, seq);
        if (!found) setNotice("Không tìm thấy tin này. Có thể nó đã bị xóa.");
        else if (variant === "sheet") onClose();
    }

    async function guarded(action: () => Promise<void>, ok = ""): Promise<void> {
        try {
            await action();
            setNotice(ok);
        } catch (error) {
            setNotice(errorText(error));
        }
    }

    if (view.name === "search") {
        return (
            <aside className="flex h-full min-h-0 w-full flex-col bg-white" aria-label="Tìm trong cuộc trò chuyện">
                <InfoSearch
                    conversationId={conversationId}
                    me={me}
                    peerName={name}
                    onJump={(seq) => void jump(seq)}
                    onBack={() => setView({ name: "main" })}
                />
                {notice ? (
                    <p role="status" className="m-0 border-t border-charcoal/10 bg-white px-4 py-2 text-sm">
                        {notice}
                    </p>
                ) : null}
            </aside>
        );
    }

    if (view.name === "shared") {
        return (
            <aside className="flex h-full min-h-0 w-full flex-col bg-white" aria-label="Nội dung đã gửi">
                <SharedFull
                    context={context}
                    tab={view.tab}
                    onTab={(tab) => setView({ name: "shared", tab })}
                    onBack={() => setView({ name: "main" })}
                />
                {notice ? (
                    <p role="status" className="m-0 border-t border-charcoal/10 bg-white px-4 py-2 text-sm">
                        {notice}
                    </p>
                ) : null}
            </aside>
        );
    }

    return (
        <aside className="flex h-full min-h-0 w-full flex-col bg-white" aria-label="Thông tin cuộc trò chuyện">
            <header className="flex min-h-[72px] items-center justify-between gap-2 border-b border-charcoal/10 px-4">
                <h2 className="m-0 text-base font-semibold">Thông tin</h2>
                <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-full hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                    aria-label="Đóng thông tin cuộc trò chuyện"
                    onClick={onClose}
                >
                    <X className="size-5" aria-hidden="true" />
                </button>
            </header>

            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
                {notice ? (
                    <p role="status" className="m-0 flex items-start justify-between gap-3 bg-green/10 px-4 py-2 text-sm">
                        <span>{notice}</span>
                        <button type="button" className="shrink-0 font-semibold underline focus-visible:outline-2 focus-visible:outline-green" onClick={() => setNotice("")}>
                            Ẩn
                        </button>
                    </p>
                ) : null}

                <section className="flex flex-col items-center gap-1 px-4 pt-6 pb-4 text-center" aria-label="Người trò chuyện">
                    {peer ? <PersonAvatar name={realName} url={peer.avatarUrl} size={80} /> : <span className="size-20 rounded-full bg-white" />}
                    <h3 className="m-0 mt-2 max-w-full text-lg font-semibold [overflow-wrap:anywhere]">{name || "Đang tải…"}</h3>
                    {nickname ? <p className="m-0 text-sm text-charcoal/65">Tên: {realName}</p> : null}
                    {status ? (
                        <p className="m-0 flex items-center gap-1.5 text-xs text-charcoal/65">
                            {detail?.peerPresence?.online ? <span className="size-2 rounded-full bg-green" aria-hidden="true" /> : null}
                            {status}
                        </p>
                    ) : null}
                </section>

                <div className="grid grid-cols-3 gap-2 px-4 pb-4" role="group" aria-label="Thao tác nhanh">
                    <QuickAction
                        icon={pinned ? PinOff : Pin}
                        label={pinned ? "Bỏ ghim" : "Ghim"}
                        pressed={pinned}
                        disabled={!pinned && !inInbox}
                        title={!pinned && !inInbox ? "Chỉ ghim được hội thoại trong Inbox" : undefined}
                        onClick={() => void guarded(() => setPinned(conversationId, !pinned), pinned ? "Đã bỏ ghim." : "Đã ghim lên đầu Inbox.")}
                    />
                    <QuickAction
                        icon={muted ? Bell : BellOff}
                        label={muted ? "Bật thông báo" : "Tắt thông báo"}
                        pressed={muted}
                        onClick={() => {
                            if (muted) void guarded(() => muteConversation(conversationId, null), "Đã bật lại thông báo.");
                            else setModal("mute");
                        }}
                    />
                    <QuickAction icon={Search} label="Tìm kiếm" onClick={() => setView({ name: "search" })} />
                </div>

                {request ? (
                    <div className="mx-4 mb-3 rounded-2xl border border-gold bg-gold/15 p-3 text-sm" role="status">
                        <p className="m-0 flex items-start gap-2 font-semibold">
                            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            {request.byMe ? `Đang chờ ${name} xác nhận xóa lịch sử` : `${name} đề nghị xóa lịch sử trò chuyện`}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {request.byMe ? (
                                <button
                                    type="button"
                                    className="min-h-10 rounded-full border border-charcoal/30 bg-white px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-green"
                                    onClick={() => void guarded(() => cancelHistoryDelete(conversationId), "Đã hủy yêu cầu xóa lịch sử.")}
                                >
                                    Hủy yêu cầu
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="min-h-10 rounded-full bg-charcoal px-4 text-sm font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                    onClick={() => setModal("incoming")}
                                >
                                    Xem yêu cầu
                                </button>
                            )}
                        </div>
                    </div>
                ) : null}

                <Group title="Tùy chỉnh">
                    <Row
                        icon={Pencil}
                        label="Đổi biệt danh"
                        detail={nickname ?? undefined}
                        onClick={() => setModal("nickname")}
                    />
                </Group>

                <SharedPreview context={context} onOpenAll={(tab) => setView({ name: "shared", tab })} />

                <Group title="Quyền riêng tư và hỗ trợ">
                    {blocked ? (
                        <Row
                            icon={Ban}
                            label={`Bỏ chặn ${name}`}
                            onClick={() => peer && void guarded(() => unblockPerson(conversationId, peer.id), "Đã bỏ chặn.")}
                        />
                    ) : (
                        <Row icon={Ban} label={`Chặn ${name}`} onClick={() => setModal("block")} />
                    )}
                    <Row
                        icon={Trash2}
                        label="Xóa lịch sử trò chuyện"
                        hint="Xóa ở cả hai phía, cần người kia đồng ý"
                        danger
                        disabled={!canDeleteBoth || request !== null}
                        onClick={() => setModal("deleteBoth")}
                    />
                    <Row
                        icon={EyeOff}
                        label="Xóa cuộc trò chuyện"
                        hint="Chỉ xóa ở phía bạn, người kia vẫn giữ tin nhắn"
                        danger
                        onClick={() => setModal("deleteMine")}
                    />
                </Group>
            </div>

            {modal === "mute" ? (
                <Dialog title="Tắt thông báo" onClose={() => setModal(null)}>
                    <ul className="m-0 grid gap-1 p-0">
                        {MUTE_OPTIONS.map((option) => (
                            <li key={option.label} className="list-none">
                                <button
                                    type="button"
                                    className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                                    onClick={() => {
                                        setModal(null);
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
            {modal === "nickname" ? (
                <NicknameDialog conversationId={conversationId} realName={realName} current={nickname} onClose={() => setModal(null)} />
            ) : null}
            {modal === "block" ? (
                <ConfirmDialog
                    title={`Chặn ${name}?`}
                    confirmLabel="Chặn"
                    onClose={() => setModal(null)}
                    onConfirm={async () => {
                        if (!peer) return;
                        await blockPerson(conversationId, peer.id);
                        onGone();
                    }}
                >
                    Người này sẽ không nhắn được cho bạn và không biết mình bị chặn. Bạn có thể bỏ chặn trong cài đặt tin nhắn.
                </ConfirmDialog>
            ) : null}
            {modal === "deleteMine" ? (
                <ConfirmDialog
                    title="Xóa cuộc trò chuyện?"
                    confirmLabel="Xóa"
                    danger
                    onClose={() => setModal(null)}
                    onConfirm={async () => {
                        await deleteForMe(conversationId);
                        onGone();
                    }}
                >
                    Cuộc trò chuyện chỉ bị xóa ở phía bạn. {name} vẫn giữ tin nhắn. Tin mới sẽ làm cuộc trò chuyện hiện lại, chỉ từ tin mới.
                </ConfirmDialog>
            ) : null}
            {modal === "deleteBoth" ? (
                <ConfirmDialog
                    title="Gửi yêu cầu xóa lịch sử?"
                    confirmLabel="Gửi yêu cầu"
                    danger
                    onClose={() => setModal(null)}
                    onConfirm={async () => {
                        await requestHistoryDelete(conversationId);
                        setNotice(`Đã gửi yêu cầu cho ${name}. Lịch sử chỉ bị xóa khi họ đồng ý.`);
                    }}
                >
                    <p className="m-0">
                        Toàn bộ tin nhắn, ảnh và tệp đã gửi tới thời điểm này sẽ bị xóa <strong>vĩnh viễn ở cả hai phía</strong>, nhưng chỉ khi
                        {" "}{name} đồng ý. Họ sẽ nhận được thông báo để xác nhận hoặc từ chối.
                    </p>
                    <p className="m-0 mt-2">Tin nhắn bạn gửi sau đó không bị ảnh hưởng. Không thể hoàn tác sau khi họ đồng ý.</p>
                </ConfirmDialog>
            ) : null}
            {modal === "incoming" && request && !request.byMe ? (
                <IncomingDeleteDialog
                    peerName={name}
                    request={request}
                    onAccept={() => acceptHistoryDelete(conversationId)}
                    onDecline={() => declineHistoryDelete(conversationId)}
                    onClose={() => setModal(null)}
                />
            ) : null}
        </aside>
    );
}

function QuickAction({
    icon: Icon,
    label,
    onClick,
    pressed,
    disabled,
    title,
}: {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    pressed?: boolean;
    disabled?: boolean;
    title?: string;
}): JSX.Element {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            aria-pressed={pressed}
            className="group flex min-h-[72px] flex-col items-center justify-start gap-1.5 rounded-2xl px-1 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-45"
            onClick={onClick}
        >
            <span
                className={`inline-flex size-11 items-center justify-center rounded-full transition-colors motion-reduce:transition-none ${pressed ? "bg-green text-cream" : "bg-white group-hover:bg-charcoal/10"}`}
            >
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="text-center leading-tight">{label}</span>
        </button>
    );
}

function Group({ title, children }: { title: string; children: ReactNode }): JSX.Element {
    return (
        <section className="border-t border-charcoal/10 px-4 py-2" aria-label={title}>
            <h3 className="m-0 flex min-h-11 items-center text-sm font-semibold">{title}</h3>
            <div className="grid gap-0.5 pb-2">{children}</div>
        </section>
    );
}

function Row({
    icon: Icon,
    label,
    hint,
    detail,
    danger = false,
    disabled = false,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    hint?: string;
    detail?: string;
    danger?: boolean;
    disabled?: boolean;
    onClick: () => void;
}): JSX.Element {
    return (
        <button
            type="button"
            disabled={disabled}
            className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent ${danger ? "text-red-700" : ""}`}
            onClick={onClick}
        >
            <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-50" : "bg-white"}`}>
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{label}</span>
                {hint ? <span className="block text-xs font-normal text-charcoal/60">{hint}</span> : null}
            </span>
            {detail ? <span className="max-w-[40%] shrink-0 truncate text-xs text-charcoal/60">{detail}</span> : null}
        </button>
    );
}
