"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type JSX } from "react";

import { PersonAvatar } from "@/features/messaging/components/person-avatar";
import { listTime } from "@/features/messaging/messaging.format";

import {
    CATEGORY_LABEL,
    STATUS_LABEL,
    errorText,
    listAll,
    listMine,
    type FeedbackCategory,
    type FeedbackItem,
    type FeedbackStatus,
} from "../feedback.api";

const TONE: Record<FeedbackStatus, string> = {
    open: "bg-gold/30 text-charcoal",
    in_progress: "bg-green/15 text-green",
    resolved: "bg-green text-cream",
    closed: "bg-charcoal/15 text-charcoal/70",
};

export function StatusChip({ status }: { status: FeedbackStatus }): JSX.Element {
    return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

interface Loaded {
    key: string;
    items: FeedbackItem[];
    cursor: string | null;
    error: string;
}

export function FeedbackList({
    mode,
    root,
    activeId,
    reloadKey,
}: {
    mode: "user" | "admin";
    root: string;
    activeId: string | null;
    reloadKey: number;
}): JSX.Element {
    const [status, setStatusFilter] = useState<FeedbackStatus | "">("");
    const [category, setCategoryFilter] = useState<FeedbackCategory | "">("");
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [more, setMore] = useState(false);
    const key = `${mode}|${status}|${category}|${reloadKey}`;

    const fetchPage = useCallback(
        (cursor?: string | null) =>
            mode === "admin" ? listAll({ status, category, cursor }) : listMine(cursor),
        [mode, status, category],
    );

    useEffect(() => {
        let active = true;
        fetchPage()
            .then((page) => {
                if (active) setLoaded({ key, items: page.items, cursor: page.nextCursor, error: "" });
            })
            .catch((error: unknown) => {
                if (active) setLoaded({ key, items: [], cursor: null, error: errorText(error, "Không tải được danh sách.") });
            });
        return () => {
            active = false;
        };
    }, [fetchPage, key]);

    const ready = loaded?.key === key;
    const items = ready ? loaded.items : (loaded?.items ?? []);

    async function loadMore(): Promise<void> {
        if (!loaded?.cursor) return;
        setMore(true);
        try {
            const page = await fetchPage(loaded.cursor);
            setLoaded((current) =>
                current ? { ...current, items: [...current.items, ...page.items], cursor: page.nextCursor } : current,
            );
        } catch {
            /* thử lại bằng nút */
        } finally {
            setMore(false);
        }
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {mode === "admin" ? (
                <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                    <label className="grid gap-1 text-xs font-semibold">
                        Trạng thái
                        <select
                            value={status}
                            onChange={(event) => setStatusFilter(event.target.value as FeedbackStatus | "")}
                            className="min-h-11 rounded-xl border border-charcoal/25 bg-white px-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-green"
                        >
                            <option value="">Tất cả</option>
                            {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((item) => (
                                <option key={item} value={item}>
                                    {STATUS_LABEL[item]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold">
                        Loại
                        <select
                            value={category}
                            onChange={(event) => setCategoryFilter(event.target.value as FeedbackCategory | "")}
                            className="min-h-11 rounded-xl border border-charcoal/25 bg-white px-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-green"
                        >
                            <option value="">Tất cả</option>
                            {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map((item) => (
                                <option key={item} value={item}>
                                    {CATEGORY_LABEL[item]}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={!ready}>
                {loaded === null ? (
                    <p className="m-0 p-6 text-sm" role="status">Đang tải…</p>
                ) : loaded.error && items.length === 0 ? (
                    <p role="alert" className="m-0 p-6 text-sm">{loaded.error}</p>
                ) : items.length === 0 ? (
                    <p className="m-0 p-6 text-center text-sm text-charcoal/70">
                        {mode === "admin" ? "Chưa có góp ý nào khớp bộ lọc." : "Bạn chưa gửi góp ý nào."}
                    </p>
                ) : (
                    <ul className="m-0 p-1">
                        {items.map((item) => (
                            <li key={item.id} className="list-none">
                                <Link
                                    href={`${root}/feedback/${item.id}`}
                                    aria-current={item.id === activeId ? "page" : undefined}
                                    className={`flex min-h-[72px] items-start gap-3 rounded-2xl px-3 py-2.5 text-inherit no-underline focus-visible:outline-2 focus-visible:outline-green ${item.id === activeId ? "bg-charcoal/5" : "hover:bg-charcoal/5"}`}
                                >
                                    {mode === "admin" ? <PersonAvatar name={item.author.displayName} url={item.author.avatarUrl} size={40} /> : null}
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            <span className={`truncate text-sm ${item.unread ? "font-bold" : "font-semibold"}`}>
                                                {mode === "admin" ? item.author.displayName : CATEGORY_LABEL[item.category]}
                                            </span>
                                            <span className="shrink-0 text-xs text-charcoal/55">· {listTime(item.lastActivityAt)}</span>
                                        </span>
                                        <span className={`line-clamp-2 text-sm ${item.unread ? "font-semibold" : "text-charcoal/70"}`}>
                                            {mode === "admin" ? `${CATEGORY_LABEL[item.category]}: ` : ""}
                                            {item.description}
                                        </span>
                                        <span className="mt-1 flex items-center gap-2">
                                            <StatusChip status={item.status} />
                                            {item.replyCount > 0 ? <span className="text-xs text-charcoal/60">{item.replyCount} trả lời</span> : null}
                                        </span>
                                    </span>
                                    {item.unread ? (
                                        <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-green" aria-label={mode === "admin" ? "Đang chờ trả lời" : "Có trả lời mới"} />
                                    ) : null}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
                {loaded?.cursor ? (
                    <div className="p-3 text-center">
                        <button
                            type="button"
                            disabled={more}
                            className="min-h-11 rounded-full border border-charcoal/25 px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-green disabled:opacity-60"
                            onClick={() => void loadMore()}
                        >
                            {more ? "Đang tải…" : "Tải thêm"}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
