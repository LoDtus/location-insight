"use client";

import { BellOff, Pin, Search, SquarePen, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";

import { loadConversations, loadMoreConversations } from "../messaging.actions";
import { listConversations } from "../messaging.api";
import { listTime, peerLabel } from "../messaging.format";
import { selectFolder, type Folder } from "../messaging.reducers";
import { useMessagingState } from "../messaging.store";
import type { ConversationSummary } from "../messaging.types";
import { PersonAvatar } from "./person-avatar";

export function ConversationList({
    root,
    activeId,
    folder,
    onFolder,
    onCompose,
    onSettings,
}: {
    root: string;
    activeId: string | null;
    folder: Folder;
    onFolder: (folder: Folder) => void;
    onCompose: () => void;
    onSettings: () => void;
}): JSX.Element {
    const conversations = useMessagingState((state) => state.conversations);
    const loaded = useMessagingState((state) => state.listLoaded);
    const error = useMessagingState((state) => state.listError);
    const cursors = useMessagingState((state) => state.cursors);
    const unread = useMessagingState((state) => state.unread);
    const [query, setQuery] = useState("");
    const [remote, setRemote] = useState<ConversationSummary[] | null>(null);
    const sentinel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void loadConversations();
    }, []);

    const local = useMemo(
        () => selectFolder({ conversations } as Parameters<typeof selectFolder>[0], folder),
        [conversations, folder],
    );
    const text = query.trim();

    useEffect(() => {
        if (text.length < 2) return;
        let active = true;
        const timer = setTimeout(() => {
            listConversations(folder, { q: text })
                .then((page) => {
                    if (active) setRemote(page.items);
                })
                .catch(() => {
                    if (active) setRemote(null);
                });
        }, 250);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [text, folder]);

    const found = text.length >= 2 ? remote : null;
    const items = useMemo(() => {
        if (text.length === 0) return local;
        const needle = text.toLocaleLowerCase("vi");
        const filtered = local.filter(
            (item) =>
                item.peer.displayName.toLocaleLowerCase("vi").includes(needle) ||
                (item.nickname ?? "").toLocaleLowerCase("vi").includes(needle),
        );
        if (!found) return filtered;
        const ids = new Set(filtered.map((item) => item.id));
        return [...filtered, ...found.filter((item) => !ids.has(item.id))];
    }, [local, found, text]);

    const cursor = cursors[folder];
    useEffect(() => {
        const element = sentinel.current;
        if (!element || !cursor || text) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) void loadMoreConversations(folder);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [cursor, folder, text]);

    return (
        <aside className="flex h-full min-h-0 w-full flex-col border-charcoal/10 bg-white md:w-[340px] md:shrink-0 md:border-r" aria-label="Danh sách hội thoại">
            <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
                <h1 className="m-0 text-xl font-semibold">Tin nhắn</h1>
                <div className="flex items-center">
                    <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                        aria-label="Cài đặt tin nhắn"
                        onClick={onSettings}
                    >
                        <Settings className="size-5" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                        aria-label="Tin nhắn mới"
                        onClick={onCompose}
                    >
                        <SquarePen className="size-5" aria-hidden="true" />
                    </button>
                </div>
            </div>
            <div className="px-4">
                <label className="flex min-h-11 items-center gap-2 rounded-full bg-cream px-4">
                    <Search className="size-4 shrink-0 text-charcoal/60" aria-hidden="true" />
                    <span className="sr-only">Tìm hội thoại</span>
                    <input
                        type="search"
                        value={query}
                        maxLength={50}
                        placeholder="Tìm kiếm"
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setQuery("");
                        }}
                        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base outline-none placeholder:text-charcoal/45"
                    />
                </label>
            </div>
            <div className="flex gap-2 px-4 py-3" role="tablist" aria-label="Thư mục">
                <FolderTab label="Inbox" selected={folder === "inbox"} count={unread.inbox} onClick={() => onFolder("inbox")} />
                <FolderTab label="Yêu cầu" selected={folder === "requests"} count={unread.requests} onClick={() => onFolder("requests")} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
                {!loaded ? (
                    <ul className="m-0 grid gap-1 p-2" aria-hidden="true">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                            <li key={index} className="flex list-none items-center gap-3 p-2">
                                <span className="size-12 animate-pulse rounded-full bg-cream" />
                                <span className="grid flex-1 gap-2">
                                    <span className="h-3 w-1/2 animate-pulse rounded bg-cream" />
                                    <span className="h-3 w-3/4 animate-pulse rounded bg-cream" />
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : error && items.length === 0 ? (
                    <div className="p-6 text-center">
                        <p role="alert" className="m-0 text-sm">
                            {error}
                        </p>
                        <button
                            type="button"
                            className="mt-3 min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green"
                            onClick={() => void loadConversations()}
                        >
                            Thử lại
                        </button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-6 text-center text-sm text-charcoal/75">
                        {text ? (
                            <p className="m-0">Không thấy ai tên “{text}”.</p>
                        ) : folder === "requests" ? (
                            <p className="m-0">Không có yêu cầu nào. Người lạ nhắn bạn lần đầu sẽ xuất hiện ở đây.</p>
                        ) : (
                            <>
                                <p className="m-0 font-semibold">Chưa có tin nhắn nào</p>
                                <button
                                    type="button"
                                    className="mt-3 min-h-11 rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                    onClick={onCompose}
                                >
                                    Bắt đầu một cuộc trò chuyện
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <ul className="m-0 p-1">
                        {items.map((item) => (
                            <Row key={item.id} item={item} active={item.id === activeId} root={root} />
                        ))}
                    </ul>
                )}
                {cursor && !text ? <div ref={sentinel} className="h-8" aria-hidden="true" /> : null}
            </div>
        </aside>
    );
}

function Row({ item, active, root }: { item: ConversationSummary; active: boolean; root: string }): JSX.Element {
    const prefix = item.lastSenderIsMe ? "Bạn: " : "";
    return (
        <li className="list-none">
            <Link
                href={`${root}/messages/${item.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[72px] items-center gap-3 rounded-2xl px-3 py-2 text-inherit no-underline focus-visible:outline-2 focus-visible:outline-green ${active ? "bg-cream" : "hover:bg-cream/70"}`}
            >
                <PersonAvatar name={item.peer.displayName} url={item.peer.avatarUrl} size={48} />
                <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${item.unread ? "font-bold" : "font-semibold"}`}>
                        {peerLabel(item)}
                    </span>
                    <span className={`flex items-center gap-1 text-sm ${item.unread ? "font-semibold text-charcoal" : "text-charcoal/65"}`}>
                        <span className="truncate">
                            {prefix}
                            {item.lastMessagePreview}
                        </span>
                        <span className="shrink-0 text-charcoal/55">· {listTime(item.lastMessageAt)}</span>
                    </span>
                </span>
                {item.pinned ? <Pin className="size-4 shrink-0 text-charcoal/50" aria-label="Đã ghim" /> : null}
                {item.muted ? <BellOff className="size-4 shrink-0 text-charcoal/50" aria-label="Đã tắt thông báo" /> : null}
                {item.unread ? <span className="size-2.5 shrink-0 rounded-full bg-green" aria-label="Chưa đọc" /> : null}
            </Link>
        </li>
    );
}

function FolderTab({
    label,
    selected,
    count,
    onClick,
}: {
    label: string;
    selected: boolean;
    count: number;
    onClick: () => void;
}): JSX.Element {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={selected}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${selected ? "border-charcoal bg-charcoal text-cream" : "border-charcoal/25 hover:bg-cream"}`}
            onClick={onClick}
        >
            {label}
            {count > 0 ? (
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${selected ? "bg-cream text-charcoal" : "bg-green text-cream"}`}>
                    {count >= 99 ? "99+" : count}
                </span>
            ) : null}
        </button>
    );
}
