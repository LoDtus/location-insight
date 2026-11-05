"use client";

import { CornerDownRight, Link2 } from "lucide-react";
import { useId, useRef, useState, type JSX, type KeyboardEvent, type ReactNode } from "react";

import { formatBytes, safeHttpUrl, shortDate } from "../messaging.format";
import type { SharedFile, SharedLink, SharedMedia } from "../messaging.types";
import { useShared, type SharedList } from "../use-shared";
import { FileTypeIcon } from "./file-card";
import { Lightbox } from "./lightbox";

export interface SharedContext {
    conversationId: string;
    /** Đổi khi có tin mới hoặc tin bị thu hồi để danh sách tải lại. */
    version: string;
    me: string;
    peerName: string;
    onJump: (seq: number) => void;
}

/** Số mục hiện trước khi bấm "Xem thêm". */
const PREVIEW = { media: 6, links: 3, files: 3 } as const;
/** Mỗi lần tải từ máy chủ; lớn hơn PREVIEW để lần "Xem thêm" đầu không phải chờ mạng. */
const PAGE_SIZE = 12;

function senderOf(context: SharedContext, senderId: string): string {
    return senderId === context.me ? "Bạn" : context.peerName;
}

function Skeleton({ rows }: { rows: number }): JSX.Element {
    return (
        <div className="grid gap-2" aria-hidden="true">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-white" />
            ))}
        </div>
    );
}

function State({ list, empty, rows = 2 }: { list: SharedList<unknown>; empty: string; rows?: number }): JSX.Element | null {
    if (list.loading) return <Skeleton rows={rows} />;
    if (list.error && list.items.length === 0) {
        return (
            <p role="alert" className="m-0 text-sm text-charcoal/75">
                {list.error}{" "}
                <button type="button" className="font-semibold underline focus-visible:outline-2 focus-visible:outline-green" onClick={list.reload}>
                    Thử lại
                </button>
            </p>
        );
    }
    if (list.items.length === 0) return <p className="m-0 text-sm text-charcoal/60">{empty}</p>;
    return null;
}

// --- Từng loại ------------------------------------------------------------

function MediaGrid({
    items,
    context,
    onZoom,
}: {
    items: SharedMedia[];
    context: SharedContext;
    onZoom: (index: number) => void;
}): JSX.Element {
    return (
        <ul className="m-0 grid list-none grid-cols-3 gap-1.5 p-0">
            {items.map((item, index) => (
                <li key={item.id} className="group/thumb relative aspect-square list-none overflow-hidden rounded-lg bg-white">
                    <button
                        type="button"
                        className="block size-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        aria-label={`Xem ảnh ${senderOf(context, item.senderId)} gửi ngày ${shortDate(item.createdAt)}`}
                        onClick={() => onZoom(index)}
                    >
                        {/* Ảnh ký hạn từ kho đối tượng, kích thước ô cố định nên không nhảy bố cục. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt="" loading="lazy" className="size-full object-cover" />
                    </button>
                    <button
                        type="button"
                        className="absolute right-1 bottom-1 inline-flex size-8 items-center justify-center rounded-full bg-charcoal/75 text-cream opacity-0 transition-opacity group-hover/thumb:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-gold motion-reduce:transition-none"
                        aria-label="Đi tới tin nhắn chứa ảnh này"
                        onClick={() => context.onJump(item.messageSeq)}
                    >
                        <CornerDownRight className="size-4" aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    );
}

function LinkRow({ item, context }: { item: SharedLink; context: SharedContext }): JSX.Element | null {
    const href = safeHttpUrl(item.url);
    if (!href) return null;
    return (
        <li className="flex min-w-0 list-none items-center gap-1">
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-inherit no-underline hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
            >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-green/10 text-green">
                    <Link2 className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.host}</span>
                    <span className="block truncate text-xs text-charcoal/65">{item.url}</span>
                    <span className="block text-[11px] text-charcoal/50">
                        {senderOf(context, item.senderId)} · {shortDate(item.createdAt)}
                    </span>
                </span>
            </a>
            <JumpButton onClick={() => context.onJump(item.messageSeq)} />
        </li>
    );
}

function FileRow({ item, context }: { item: SharedFile; context: SharedContext }): JSX.Element {
    return (
        <li className="flex min-w-0 list-none items-center gap-1">
            <a
                href={item.url}
                download={item.fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-inherit no-underline hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                aria-label={`Tải về ${item.fileName}, ${formatBytes(item.byteSize)}`}
            >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-green/10 text-green">
                    <FileTypeIcon fileName={item.fileName} className="size-4" />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.fileName}</span>
                    <span className="block text-xs text-charcoal/65">
                        {formatBytes(item.byteSize)} · {shortDate(item.createdAt)}
                    </span>
                    <span className="block text-[11px] text-charcoal/50">{senderOf(context, item.senderId)}</span>
                </span>
            </a>
            <JumpButton onClick={() => context.onJump(item.messageSeq)} />
        </li>
    );
}

function JumpButton({ onClick }: { onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-charcoal/55 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green"
            aria-label="Đi tới tin nhắn"
            onClick={onClick}
        >
            <CornerDownRight className="size-4" aria-hidden="true" />
        </button>
    );
}

// --- Ba tab nội dung đã gửi ------------------------------------------------

export type SharedTab = "media" | "links" | "files";

const TABS: Array<{ id: SharedTab; label: string; empty: string; rows: number }> = [
    { id: "media", label: "File phương tiện", empty: "Chưa có ảnh nào được gửi.", rows: 1 },
    { id: "links", label: "Liên kết", empty: "Chưa có liên kết nào được gửi.", rows: 2 },
    { id: "files", label: "Tệp", empty: "Chưa có tệp nào được gửi.", rows: 2 },
];

/**
 * Ảnh, liên kết và tệp đã gửi, mỗi loại một tab. Mỗi tab hiện vài mục đầu, "Xem thêm" mở rộng
 * (và tải trang kế từ máy chủ khi đã hiện hết phần có sẵn), "Thu gọn" về lại số mục ban đầu.
 */
export function SharedTabs({ context }: { context: SharedContext }): JSX.Element {
    const media = useShared(context.conversationId, "media", context.version, PAGE_SIZE);
    const links = useShared(context.conversationId, "links", context.version, PAGE_SIZE);
    const files = useShared(context.conversationId, "files", context.version, PAGE_SIZE);
    const [tab, setTab] = useState<SharedTab>("media");
    const [expanded, setExpanded] = useState<Record<SharedTab, boolean>>({ media: false, links: false, files: false });
    const [zoom, setZoom] = useState<number | null>(null);
    const tabRefs = useRef<Partial<Record<SharedTab, HTMLButtonElement | null>>>({});
    const baseId = useId();

    const lists: Record<SharedTab, SharedList<unknown>> = { media, links, files };
    const list = lists[tab];
    const open = expanded[tab];
    const limit = open ? Number.POSITIVE_INFINITY : PREVIEW[tab];
    const tabId = (id: SharedTab): string => `${baseId}-tab-${id}`;
    const panelId = (id: SharedTab): string => `${baseId}-panel-${id}`;
    const visibleMedia = media.items.slice(0, tab === "media" ? limit : PREVIEW.media);

    function select(next: SharedTab, focus = false): void {
        setTab(next);
        if (focus) tabRefs.current[next]?.focus();
    }

    function onTabKey(event: KeyboardEvent<HTMLButtonElement>): void {
        const index = TABS.findIndex((item) => item.id === tab);
        let next: number | null = null;
        if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = TABS.length - 1;
        if (next === null) return;
        event.preventDefault();
        select(TABS[next].id, true);
    }

    function setOpen(value: boolean): void {
        setExpanded((current) => ({ ...current, [tab]: value }));
    }

    function showMore(): void {
        // Đã mở rộng và hiện hết phần có sẵn, hoặc phần có sẵn chưa vượt số mục xem trước: tải trang kế.
        if (open || list.items.length <= PREVIEW[tab]) list.loadMore();
        setOpen(true);
    }

    const hiddenLocal = !open && list.items.length > PREVIEW[tab];
    const canMore = hiddenLocal || list.hasMore;
    const canCollapse = open && list.items.length > PREVIEW[tab];
    const current = TABS.find((item) => item.id === tab) ?? TABS[0];

    return (
        <section className="border-t border-charcoal/10 px-4 pt-2 pb-3" aria-label="Nội dung đã gửi">
            <div role="tablist" aria-label="Loại nội dung đã gửi" className="grid grid-cols-3 border-b border-charcoal/10">
                {TABS.map((item) => {
                    const selected = item.id === tab;
                    return (
                        <button
                            key={item.id}
                            ref={(element) => {
                                tabRefs.current[item.id] = element;
                            }}
                            id={tabId(item.id)}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={panelId(item.id)}
                            tabIndex={selected ? 0 : -1}
                            className={`-mb-px min-h-11 border-b-2 px-1 text-xs font-semibold leading-tight focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green ${selected ? "border-charcoal text-charcoal" : "border-transparent text-charcoal/60 hover:text-charcoal"}`}
                            onClick={() => select(item.id)}
                            onKeyDown={onTabKey}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
            <div id={panelId(tab)} role="tabpanel" aria-labelledby={tabId(tab)} tabIndex={0} className="pt-3 focus-visible:outline-2 focus-visible:outline-green">
                <State list={list} empty={current.empty} rows={current.rows} />
                {tab === "media" && visibleMedia.length > 0 ? <MediaGrid items={visibleMedia} context={context} onZoom={setZoom} /> : null}
                {tab === "links" && links.items.length > 0 ? (
                    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-0.5 p-0">
                        {links.items.slice(0, limit).map((item, index) => (
                            <LinkRow key={`${item.messageId}-${index}`} item={item} context={context} />
                        ))}
                    </ul>
                ) : null}
                {tab === "files" && files.items.length > 0 ? (
                    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-0.5 p-0">
                        {files.items.slice(0, limit).map((item) => (
                            <FileRow key={item.id} item={item} context={context} />
                        ))}
                    </ul>
                ) : null}
                {list.error && list.items.length > 0 ? (
                    <p role="alert" className="m-0 mt-2 text-sm text-charcoal/75">
                        {list.error}
                    </p>
                ) : null}
                {!list.loading && (canMore || canCollapse) ? (
                    <div className="mt-2 flex gap-2">
                        {canMore ? (
                            <PanelButton disabled={list.loadingMore} onClick={showMore}>
                                {list.loadingMore ? "Đang tải…" : "Xem thêm"}
                            </PanelButton>
                        ) : null}
                        {canCollapse ? <PanelButton onClick={() => setOpen(false)}>Thu gọn</PanelButton> : null}
                    </div>
                ) : null}
            </div>
            {zoom !== null ? <Lightbox files={visibleMedia} start={zoom} onClose={() => setZoom(null)} /> : null}
        </section>
    );
}

function PanelButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            disabled={disabled}
            className="min-h-11 flex-1 rounded-xl border border-charcoal/15 bg-white text-sm font-semibold hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green disabled:opacity-60"
            onClick={onClick}
        >
            {children}
        </button>
    );
}
