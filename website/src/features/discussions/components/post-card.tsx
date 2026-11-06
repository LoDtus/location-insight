"use client";

import { Ban, Bookmark, ChevronRight, Flag, Heart, Link2, MessageCircle, MoreHorizontal, Repeat2, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import type { DiscussionPost } from "@/features/discussions/discussions.api";
import { Avatar } from "@/features/discussions/components/post-composer";
import ImageLightbox from "@/shared/components/lightbox/image-lightbox";

/** Khóa cũ: trước đây bài đã lưu chỉ nằm ở trình duyệt; giờ chuyển lên server một lần rồi xóa. */
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

export function clearLegacySavedPosts(): void {
    try {
        window.localStorage.removeItem(SAVED_KEY);
    } catch {
        // storage bị chặn: bỏ qua
    }
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

/** "06/11/2026 14:05" theo giờ Việt Nam (tooltip của thời gian tương đối). */
export function fullTime(iso: string): string {
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(iso));
}

export function PostCard({
    post,
    root,
    connected,
    mine,
    onLike,
    onReply,
    onRepost,
    onQuote,
    onShare,
    onSave,
    onDelete,
    onReport,
    onBlock,
    onCopyLink,
    online,
    onTopic,
}: {
    post: DiscussionPost;
    root: ShellRoot;
    connected?: boolean;
    mine: boolean;
    onLike: () => void;
    onReply: () => void;
    onRepost: () => void;
    onQuote: () => void;
    onShare: () => void;
    onSave: () => void;
    onDelete: () => void;
    onReport: () => void;
    onBlock: () => void;
    onCopyLink: () => void;
    /** Trạng thái trực tuyến đã làm mới; không truyền thì dùng `post.authorOnline`. */
    online?: boolean;
    /** Bấm chủ đề: lọc tại chỗ (feed). Không truyền thì mở feed lọc theo chủ đề. */
    onTopic?: (slug: string) => void;
}): JSX.Element {
    const saved = post.savedByMe;
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
        <article ref={rootRef} className="flex gap-3 px-4 pt-3 pb-1.5">
            <div className="flex w-10 shrink-0 flex-col items-center">
                <Avatar name={post.authorName} url={post.authorAvatarUrl} online={online ?? post.authorOnline} />
                {connected ? <span className="-mb-6 mt-2 w-0.5 flex-1 bg-charcoal/20" aria-hidden="true" /> : null}
            </div>
            {/* Cột giữa: dòng người đăng + chủ đề + thời gian, nội dung ngay bên dưới. */}
            <div className="min-w-0 flex-1">
                <header className="flex min-w-0 items-center gap-1 text-[15px] leading-5">
                    <Link
                        href={post.authorUsername ? `${root}/profile/@${post.authorUsername}` : `${root}/feed/${post.id}`}
                        className="min-w-0 shrink truncate font-semibold text-charcoal no-underline hover:underline"
                    >
                        {post.authorName}
                    </Link>
                    {post.authorUsername ? (
                        <Link
                            href={`${root}/profile/@${post.authorUsername}`}
                            className="hidden min-w-0 truncate text-sm text-charcoal/50 no-underline hover:underline sm:inline"
                        >
                            @{post.authorUsername}
                        </Link>
                    ) : null}
                    {post.topicName ? (
                        <>
                            <ChevronRight className="size-3.5 shrink-0 text-charcoal/35" aria-hidden="true" />
                            {onTopic ? (
                                <button
                                    type="button"
                                    onClick={() => onTopic(post.topicSlug)}
                                    title={`Xem chủ đề ${post.topicName}`}
                                    className="min-w-0 truncate rounded bg-transparent p-0 text-sm font-semibold text-green hover:underline focus-visible:outline-2 focus-visible:outline-green"
                                >
                                    {post.topicName}
                                </button>
                            ) : (
                                <Link
                                    href={`${root}/feed?chu-de=${encodeURIComponent(post.topicSlug)}`}
                                    title={`Xem chủ đề ${post.topicName}`}
                                    className="min-w-0 truncate text-sm font-semibold text-green no-underline hover:underline"
                                >
                                    {post.topicName}
                                </Link>
                            )}
                        </>
                    ) : null}
                    <time
                        dateTime={post.createdAt}
                        title={fullTime(post.createdAt)}
                        className="shrink-0 text-sm text-charcoal/45"
                    >
                        {relativeTime(post.createdAt)}
                    </time>
                </header>
                <Link href={`${root}/feed/${post.id}`} className="mt-0.5 block text-inherit no-underline">
                    <p className="m-0 text-[15px] leading-relaxed whitespace-pre-wrap break-words">{post.body}</p>
                </Link>
                {post.media.length > 0 ? <MediaGrid media={post.media} /> : null}
                {/* Nút tương tác dồn trái, cách đều; nút chỉ có icon là hình tròn. */}
                <div className="relative mt-1.5 -ml-2 flex items-center gap-2 text-charcoal/70 sm:gap-4">
                    <Action icon="like" label={post.likedByMe ? "Bỏ thích" : "Thích"} count={post.likeCount} active={post.likedByMe} onClick={onLike} />
                    <Action icon="reply" label="Trả lời" count={post.replyCount} onClick={onReply} />
                    <Action icon="repost" label="Đăng lại hoặc trích dẫn" active={repostMenu} onClick={() => setRepostMenu((current) => !current)} />
                    <Action icon="share" label="Chia sẻ" onClick={onShare} />
                    <Action icon="save" label={saved ? "Bỏ lưu" : "Lưu bài"} active={saved} onClick={onSave} />
                    {repostMenu ? (
                        <div className="absolute top-11 left-24 z-20 w-44 rounded-2xl bg-white p-1.5 shadow-[0_8px_24px_rgba(16,17,17,0.16)] ring-1 ring-charcoal/10">
                            <button
                                type="button"
                                className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-charcoal/5"
                                onClick={() => {
                                    setRepostMenu(false);
                                    onRepost();
                                }}
                            >
                                Đăng lại
                            </button>
                            <button
                                type="button"
                                className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-charcoal/5"
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
            {/* Cột phải: nút ba chấm tách riêng; self-start để cột không dãn theo chiều cao bài (menu bám ngay dưới nút). */}
            <div className="relative -mt-1 -mr-2 shrink-0 self-start">
                <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-full text-charcoal/55 hover:bg-charcoal/[0.06] hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    aria-expanded={menu}
                    aria-haspopup="menu"
                    aria-label="Thêm lựa chọn"
                    onClick={() => setMenu((current) => !current)}
                >
                    <MoreHorizontal className="size-5" aria-hidden="true" />
                </button>
                {menu ? (
                    <div
                        role="menu"
                        aria-label="Lựa chọn cho bài này"
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setMenu(false);
                        }}
                        className="absolute top-full right-0 z-20 mt-1 w-60 rounded-2xl bg-white p-1.5 shadow-[0_8px_24px_rgba(16,17,17,0.16)] ring-1 ring-charcoal/10"
                    >
                        <MenuItem
                            icon={<Link2 className="size-4" aria-hidden="true" />}
                            label="Sao chép liên kết"
                            onClick={() => {
                                setMenu(false);
                                onCopyLink();
                            }}
                        />
                        {mine ? (
                            <MenuItem
                                danger
                                icon={<Trash2 className="size-4" aria-hidden="true" />}
                                label="Xóa bài"
                                onClick={() => {
                                    setMenu(false);
                                    onDelete();
                                }}
                            />
                        ) : (
                            <>
                                <MenuItem
                                    icon={<Flag className="size-4" aria-hidden="true" />}
                                    label="Báo cáo bài viết"
                                    onClick={() => {
                                        setMenu(false);
                                        onReport();
                                    }}
                                />
                                <MenuItem
                                    danger
                                    icon={<Ban className="size-4" aria-hidden="true" />}
                                    label={`Chặn ${post.authorUsername ? `@${post.authorUsername}` : post.authorName}`}
                                    onClick={() => {
                                        setMenu(false);
                                        onBlock();
                                    }}
                                />
                            </>
                        )}
                    </div>
                ) : null}
            </div>
        </article>
    );
}

function MenuItem({ icon, label, danger = false, onClick }: { icon: JSX.Element; label: string; danger?: boolean; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl border-0 bg-transparent px-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green ${danger ? "text-red-700 hover:bg-red-50" : "text-charcoal hover:bg-charcoal/5"}`}
        >
            {icon}
            <span className="truncate">{label}</span>
        </button>
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
            className={`inline-flex h-9 items-center justify-center rounded-full text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${count ? "min-w-9 gap-1.5 px-2" : "w-9 p-0"} ${active ? "text-green hover:bg-green/10" : "hover:bg-green/10 hover:text-green"}`}
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
    const [zoom, setZoom] = useState<number | null>(null);
    const images = media.filter((item) => item.kind !== "video");
    return (
        <div className={`mt-3 grid gap-1 overflow-hidden rounded-2xl ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {media.map((item) =>
                item.kind === "video" ? (
                    <video key={item.id} className="max-h-80 w-full bg-charcoal" controls src={item.url} />
                ) : (
                    <button
                        key={item.id}
                        type="button"
                        aria-label="Xem ảnh"
                        onClick={() => setZoom(images.findIndex((image) => image.id === item.id))}
                        className="block cursor-zoom-in border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green"
                    >
                        {/* Signed media URLs expire and are not known at build time. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt="" className="max-h-80 w-full object-cover" />
                    </button>
                ),
            )}
            {zoom !== null ? (
                <ImageLightbox images={images.map((item) => ({ id: item.id, src: item.url }))} start={Math.max(0, zoom)} onClose={() => setZoom(null)} />
            ) : null}
        </div>
    );
}
