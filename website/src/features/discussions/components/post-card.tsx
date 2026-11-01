"use client";

import { Bookmark, Heart, MessageCircle, MoreHorizontal, Repeat2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import type { DiscussionPost } from "@/features/discussions/discussions.api";
import { Avatar } from "@/features/discussions/components/post-composer";

const SAVED_KEY = "discussion-saved";

export function readSavedPosts(): string[] {
    if (typeof window === "undefined") return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]") as unknown;
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
        return [];
    }
}

export function writeSavedPosts(ids: string[]): void {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
}

export function relativeTime(iso: string): string {
    const delta = Date.now() - new Date(iso).getTime();
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (delta < minute) return "Vừa xong";
    if (delta < hour) return `${Math.floor(delta / minute)} phút`;
    if (delta < day) return `${Math.floor(delta / hour)} giờ`;
    if (delta < 7 * day) return `${Math.floor(delta / day)} ngày`;
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(iso));
}

export function PostCard({
    post,
    root,
    connected,
    saved,
    mine,
    onLike,
    onReply,
    onRepost,
    onQuote,
    onShare,
    onSave,
    onDelete,
}: {
    post: DiscussionPost;
    root: ShellRoot;
    connected?: boolean;
    saved: boolean;
    mine: boolean;
    onLike: () => void;
    onReply: () => void;
    onRepost: () => void;
    onQuote: () => void;
    onShare: () => void;
    onSave: () => void;
    onDelete: () => void;
}): JSX.Element {
    const [menu, setMenu] = useState(false);
    const [repostMenu, setRepostMenu] = useState(false);
    const rootRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!menu && !repostMenu) return;
        function onPointer(event: MouseEvent): void {
            if (!(event.target instanceof Node)) return;
            if (!rootRef.current?.contains(event.target)) {
                setMenu(false);
                setRepostMenu(false);
            }
        }
        window.addEventListener("mousedown", onPointer);
        return () => window.removeEventListener("mousedown", onPointer);
    }, [menu, repostMenu]);

    return (
        <article ref={rootRef} className="flex gap-3 px-4 py-3">
            <div className="flex w-10 flex-col items-center">
                <Avatar name={post.authorName} url={post.authorAvatarUrl} />
                {connected ? <span className="-mb-6 mt-2 w-0.5 flex-1 bg-charcoal/25" aria-hidden="true" /> : null}
            </div>
            <div className="min-w-0 flex-1">
                <header className="flex items-start gap-2">
                    <p className="m-0 min-w-0 flex-1 text-sm">
                        <Link href={`${root}/feed/${post.id}`} className="font-semibold text-inherit no-underline">
                            {post.authorName}
                        </Link>
                        {post.authorUsername ? (
                            <Link href={`${root}/profile/${post.authorUsername}`} className="text-charcoal/55 no-underline">
                                {" "}@{post.authorUsername}
                            </Link>
                        ) : null}
                        <span className="text-charcoal/55"> · {relativeTime(post.createdAt)}</span>
                    </p>
                    <div className="relative">
                        {mine ? (
                            <button
                                type="button"
                                className="inline-flex size-11 items-center justify-center rounded-full text-charcoal/70 hover:bg-green/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                aria-expanded={menu}
                                aria-label="Thêm lựa chọn"
                                onClick={() => setMenu((current) => !current)}
                            >
                                <MoreHorizontal className="size-5" aria-hidden="true" />
                            </button>
                        ) : null}
                        {menu && mine ? (
                            <div className="absolute right-0 z-20 w-56 rounded-2xl border border-charcoal/10 bg-white p-2 shadow-sm">
                                <button
                                    type="button"
                                    className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-cream"
                                    onClick={() => {
                                        setMenu(false);
                                        onDelete();
                                    }}
                                >
                                    Xóa bài
                                </button>
                            </div>
                        ) : null}
                    </div>
                </header>
                <Link href={`${root}/feed/${post.id}`} className="mt-1 block text-inherit no-underline">
                    {post.topicName ? (
                        <p className="m-0 text-sm font-semibold text-green">Chủ đề: {post.topicName}</p>
                    ) : null}
                    <p className="mt-1 mb-0 whitespace-pre-wrap text-base leading-relaxed">{post.body}</p>
                </Link>
                {post.media.length > 0 ? <MediaGrid media={post.media} /> : null}
                <div className="relative mt-1 flex items-center justify-between text-charcoal/70">
                    <Action icon="like" label={post.likedByMe ? "Bỏ thích" : "Thích"} count={post.likeCount} active={post.likedByMe} onClick={onLike} />
                    <Action icon="reply" label="Trả lời" count={post.replyCount} onClick={onReply} />
                    <Action icon="repost" label="Đăng lại hoặc trích dẫn" active={repostMenu} onClick={() => setRepostMenu((current) => !current)} />
                    <Action icon="share" label="Chia sẻ" onClick={onShare} />
                    <Action icon="save" label={saved ? "Bỏ lưu" : "Lưu bài"} active={saved} onClick={onSave} />
                    {repostMenu ? (
                        <div className="absolute top-12 left-1/3 z-20 w-44 rounded-2xl border border-charcoal/10 bg-white p-2 shadow-sm">
                            <button
                                type="button"
                                className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-cream"
                                onClick={() => {
                                    setRepostMenu(false);
                                    onRepost();
                                }}
                            >
                                Đăng lại
                            </button>
                            <button
                                type="button"
                                className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-cream"
                                onClick={() => {
                                    setRepostMenu(false);
                                    onQuote();
                                }}
                            >
                                Trích dẫn
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

function Action({
    icon,
    label,
    count,
    active,
    onClick,
}: {
    icon: "like" | "reply" | "repost" | "share" | "save";
    label: string;
    count?: number;
    active?: boolean;
    onClick: () => void;
}): JSX.Element {
    const glyph = {
        like: <Heart className={`size-5 ${active ? "fill-green" : ""}`} aria-hidden="true" />,
        reply: <MessageCircle className="size-5" aria-hidden="true" />,
        repost: <Repeat2 className="size-5" aria-hidden="true" />,
        share: <Send className="size-5" aria-hidden="true" />,
        save: <Bookmark className={`size-5 ${active ? "fill-green" : ""}`} aria-hidden="true" />,
    }[icon];
    return (
        <button
            type="button"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${active ? "text-green" : "hover:bg-green/10 hover:text-green"}`}
            aria-pressed={active}
            aria-label={count ? `${label}, ${count}` : label}
            onClick={onClick}
        >
            {glyph}
            {count ? <span>{count}</span> : null}
        </button>
    );
}

function MediaGrid({ media }: { media: DiscussionPost["media"] }): JSX.Element {
    return (
        <div className={`mt-3 grid gap-1 overflow-hidden rounded-2xl ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {media.map((item) =>
                item.kind === "video" ? (
                    <video key={item.id} className="max-h-80 w-full bg-charcoal" controls src={item.url} />
                ) : (
                    // Signed media URLs expire and are not known at build time.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={item.id} src={item.url} alt="" className="max-h-80 w-full object-cover" />
                ),
            )}
        </div>
    );
}
