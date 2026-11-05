"use client";

import { ArrowLeft, ChevronDown, CornerDownRight, Link2 } from "lucide-react";
import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";

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

const PREVIEW = { media: 6, links: 3, files: 3 } as const;
const FULL_PAGE = 24;

function senderOf(context: SharedContext, senderId: string): string {
    return senderId === context.me ? "Bạn" : context.peerName;
}

function Section({
    title,
    count,
    children,
    action,
}: {
    title: string;
    count?: number;
    children: ReactNode;
    action?: ReactNode;
}): JSX.Element {
    return (
        <details open className="group border-t border-charcoal/10 px-4 py-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-sm font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-green [&::-webkit-details-marker]:hidden">
                <span>
                    {title}
                    {count ? <span className="ml-1.5 font-normal text-charcoal/55">{count}</span> : null}
                </span>
                <ChevronDown className="size-4 text-charcoal/55 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="pt-1 pb-2">{children}</div>
            {action}
        </details>
    );
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

function SeeAll({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            className="mt-1 mb-1 min-h-11 w-full rounded-xl border border-charcoal/15 bg-white text-sm font-semibold hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
            onClick={onClick}
        >
            {label}
        </button>
    );
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

// --- Xem nhanh trong panel ------------------------------------------------

export type SharedTab = "media" | "links" | "files";

export function SharedPreview({
    context,
    onOpenAll,
}: {
    context: SharedContext;
    onOpenAll: (tab: SharedTab) => void;
}): JSX.Element {
    const media = useShared(context.conversationId, "media", context.version, PREVIEW.media);
    const links = useShared(context.conversationId, "links", context.version, PREVIEW.links);
    const files = useShared(context.conversationId, "files", context.version, PREVIEW.files);
    const [zoom, setZoom] = useState<number | null>(null);

    return (
        <>
            <Section title="File phương tiện" action={media.hasMore ? <SeeAll label="Xem tất cả ảnh" onClick={() => onOpenAll("media")} /> : null}>
                <State list={media} empty="Chưa có ảnh nào được gửi." rows={1} />
                {media.items.length > 0 ? <MediaGrid items={media.items} context={context} onZoom={setZoom} /> : null}
            </Section>
            <Section title="Liên kết" action={links.hasMore ? <SeeAll label="Xem tất cả liên kết" onClick={() => onOpenAll("links")} /> : null}>
                <State list={links} empty="Chưa có liên kết nào được gửi." />
                {links.items.length > 0 ? (
                    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-0.5 p-0">
                        {links.items.map((item, index) => (
                            <LinkRow key={`${item.messageId}-${index}`} item={item} context={context} />
                        ))}
                    </ul>
                ) : null}
            </Section>
            <Section title="Tệp" action={files.hasMore ? <SeeAll label="Xem tất cả tệp" onClick={() => onOpenAll("files")} /> : null}>
                <State list={files} empty="Chưa có tệp nào được gửi." />
                {files.items.length > 0 ? (
                    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-0.5 p-0">
                        {files.items.map((item) => (
                            <FileRow key={item.id} item={item} context={context} />
                        ))}
                    </ul>
                ) : null}
            </Section>
            {zoom !== null ? <Lightbox files={media.items} start={zoom} onClose={() => setZoom(null)} /> : null}
        </>
    );
}

// --- Xem tất cả -----------------------------------------------------------

const TABS: Array<{ id: SharedTab; label: string }> = [
    { id: "media", label: "Ảnh" },
    { id: "links", label: "Liên kết" },
    { id: "files", label: "Tệp" },
];

export function SharedFull({
    context,
    tab,
    onTab,
    onBack,
}: {
    context: SharedContext;
    tab: SharedTab;
    onTab: (tab: SharedTab) => void;
    onBack: () => void;
}): JSX.Element {
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-1 border-b border-charcoal/10 px-2">
                <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-full hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                    aria-label="Quay lại thông tin hội thoại"
                    onClick={onBack}
                >
                    <ArrowLeft className="size-5" aria-hidden="true" />
                </button>
                <h2 className="m-0 text-base font-semibold">Nội dung đã gửi</h2>
            </div>
            <div className="flex gap-1.5 px-3 py-2" role="tablist" aria-label="Loại nội dung">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        className={`min-h-10 flex-1 rounded-full border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${tab === item.id ? "border-charcoal bg-charcoal text-cream" : "border-charcoal/25 hover:bg-charcoal/5"}`}
                        onClick={() => onTab(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4" role="tabpanel">
                {tab === "media" ? <FullMedia context={context} /> : tab === "links" ? <FullLinks context={context} /> : <FullFiles context={context} />}
            </div>
        </div>
    );
}

function More({ list }: { list: SharedList<unknown> }): JSX.Element | null {
    const sentinel = useRef<HTMLDivElement>(null);
    const { hasMore, loadMore } = list;
    useEffect(() => {
        const element = sentinel.current;
        if (!element || !hasMore) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) loadMore();
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);
    if (!hasMore) return null;
    return (
        <div ref={sentinel} className="py-3 text-center">
            <button
                type="button"
                disabled={list.loadingMore}
                className="min-h-11 rounded-full border border-charcoal/25 px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-green disabled:opacity-60"
                onClick={loadMore}
            >
                {list.loadingMore ? "Đang tải…" : "Tải thêm"}
            </button>
        </div>
    );
}

function FullMedia({ context }: { context: SharedContext }): JSX.Element {
    const list = useShared(context.conversationId, "media", context.version, FULL_PAGE);
    const [zoom, setZoom] = useState<number | null>(null);
    return (
        <>
            <State list={list} empty="Chưa có ảnh nào được gửi." rows={3} />
            {list.items.length > 0 ? <MediaGrid items={list.items} context={context} onZoom={setZoom} /> : null}
            <More list={list} />
            {zoom !== null ? <Lightbox files={list.items} start={zoom} onClose={() => setZoom(null)} /> : null}
        </>
    );
}

function FullLinks({ context }: { context: SharedContext }): JSX.Element {
    const list = useShared(context.conversationId, "links", context.version, FULL_PAGE);
    return (
        <>
            <State list={list} empty="Chưa có liên kết nào được gửi." rows={4} />
            {list.items.length > 0 ? (
                <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-0.5 p-0">
                    {list.items.map((item, index) => (
                        <LinkRow key={`${item.messageId}-${index}`} item={item} context={context} />
                    ))}
                </ul>
            ) : null}
            <More list={list} />
        </>
    );
}

function FullFiles({ context }: { context: SharedContext }): JSX.Element {
    const list = useShared(context.conversationId, "files", context.version, FULL_PAGE);
    return (
        <>
            <State list={list} empty="Chưa có tệp nào được gửi." rows={4} />
            {list.items.length > 0 ? (
                <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-0.5 p-0">
                    {list.items.map((item) => (
                        <FileRow key={item.id} item={item} context={context} />
                    ))}
                </ul>
            ) : null}
            <More list={list} />
        </>
    );
}
