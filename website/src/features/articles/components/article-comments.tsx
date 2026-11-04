"use client";

import { Heart, Loader2, MessageSquareReply, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type JSX } from "react";

import {
    createArticleComment,
    deleteArticleComment,
    editArticleComment,
    likeArticleComment,
    getArticleStats,
    listArticleComments,
    type ArticleComment,
    type ArticleThread,
} from "@/features/articles/articles.api";
import { useArticleEngagement } from "@/features/articles/components/article-engagement-provider";
import { AuthApiError } from "@/features/auth/auth.api";
import { useLocale } from "@/shared/hooks/useLocale";

const BODY_MAX = 2000;
type Sort = "new" | "top";

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return (parts.slice(-2).map((part) => part[0]).join("") || "?").toLocaleUpperCase("vi");
}

function relativeTime(iso: string, locale: string): string {
    const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "vi", { numeric: "auto" });
    const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ["year", 31536000],
        ["month", 2592000],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
    ];
    for (const [unit, size] of steps) {
        if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
    }
    return formatter.format(0, "second");
}

function Composer({
    placeholder,
    submitLabel,
    initial = "",
    autoFocus = false,
    onSubmit,
    onCancel,
}: {
    placeholder: string;
    submitLabel: string;
    initial?: string;
    autoFocus?: boolean;
    onSubmit: (body: string) => Promise<void>;
    onCancel?: () => void;
}): JSX.Element {
    const { locale } = useLocale();
    const vi = locale === "vi";
    const [value, setValue] = useState(initial);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const body = value.trim();
        if (!body || pending) return;
        setPending(true);
        setError("");
        try {
            await onSubmit(body);
            setValue("");
        } catch (failure) {
            setError(failure instanceof AuthApiError ? failure.message : vi ? "Chưa gửi được bình luận." : "Could not send the comment.");
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} className="grid gap-2">
            <textarea
                autoFocus={autoFocus}
                value={value}
                maxLength={BODY_MAX}
                placeholder={placeholder}
                aria-label={placeholder}
                onChange={(event) => setValue(event.target.value)}
                className="box-border min-h-20 w-full resize-y rounded-xl border border-charcoal/20 bg-white px-3 py-2 font-sans text-sm text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-charcoal/60">{`${value.length}/${BODY_MAX}`}</span>
                <div className="flex items-center gap-2">
                    {onCancel ? (
                        <button type="button" onClick={onCancel} className="min-h-9 rounded-full border-0 bg-transparent px-3 text-sm font-semibold text-charcoal/75 hover:underline">
                            {vi ? "Hủy" : "Cancel"}
                        </button>
                    ) : null}
                    <button type="submit" disabled={pending || !value.trim()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-green px-4 text-sm font-semibold text-cream disabled:opacity-50">
                        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                        {submitLabel}
                    </button>
                </div>
            </div>
            {error ? (
                <p role="alert" className="m-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
        </form>
    );
}

function CommentItem({
    comment,
    reply,
    onReply,
    onChanged,
}: {
    comment: ArticleComment;
    reply: boolean;
    onReply: (comment: ArticleComment, body: string) => Promise<void>;
    onChanged: () => void;
}): JSX.Element {
    const { locale } = useLocale();
    const vi = locale === "vi";
    const { signedIn, isAdmin, likedIds, setLiked } = useArticleEngagement();
    const [replying, setReplying] = useState(false);
    const [editing, setEditing] = useState(false);
    const [likes, setLikes] = useState(comment.likes);
    const liked = likedIds.has(comment.id);
    const [error, setError] = useState("");

    async function toggleLike(): Promise<void> {
        if (!signedIn) return;
        const next = !liked;
        setLiked(comment.id, next);
        setLikes((count) => count + (next ? 1 : -1));
        try {
            const result = await likeArticleComment(comment.id, next);
            setLikes(result.likes);
        } catch {
            setLiked(comment.id, !next);
            setLikes((count) => count + (next ? -1 : 1));
        }
    }

    async function remove(): Promise<void> {
        if (!window.confirm(vi ? "Xóa bình luận này?" : "Delete this comment?")) return;
        try {
            await deleteArticleComment(comment.id);
            onChanged();
        } catch (failure) {
            setError(failure instanceof AuthApiError ? failure.message : vi ? "Chưa xóa được." : "Could not delete.");
        }
    }

    if (comment.removed) {
        return <p className="m-0 text-sm text-charcoal/60 italic">{vi ? "Bình luận đã bị gỡ." : "This comment was removed."}</p>;
    }

    const name = comment.author?.name ?? (vi ? "Người dùng" : "User");
    const action = "inline-flex min-h-9 items-center gap-1.5 rounded-full border-0 bg-transparent px-2 text-sm font-semibold text-charcoal/75 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green";
    return (
        <div className="flex gap-3">
            <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-green/15 font-sans font-semibold text-green ${reply ? "size-8 text-xs" : "size-10 text-sm"}`}>
                {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
                <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm">
                    {comment.author?.username ? (
                        <Link href={`/app/profile/@${comment.author.username}`} className="font-semibold text-charcoal no-underline hover:underline">
                            {name}
                        </Link>
                    ) : (
                        <b>{name}</b>
                    )}
                    <time dateTime={comment.createdAt} className="text-xs text-charcoal/60">
                        {relativeTime(comment.createdAt, locale)}
                    </time>
                    {comment.editedAt ? <span className="text-xs text-charcoal/50">{vi ? "(đã chỉnh sửa)" : "(edited)"}</span> : null}
                </p>
                {editing ? (
                    <div className="mt-2">
                        <Composer
                            autoFocus
                            initial={comment.body}
                            placeholder={vi ? "Sửa bình luận" : "Edit comment"}
                            submitLabel={vi ? "Lưu" : "Save"}
                            onCancel={() => setEditing(false)}
                            onSubmit={async (body) => {
                                await editArticleComment(comment.id, body);
                                setEditing(false);
                                onChanged();
                            }}
                        />
                    </div>
                ) : (
                    <p className="mt-1 mb-0 text-base leading-relaxed whitespace-pre-wrap break-words">{comment.body}</p>
                )}
                {!editing ? (
                    <div className="mt-1 -ml-2 flex flex-wrap items-center gap-1 font-sans">
                        <button type="button" disabled={!signedIn} aria-pressed={liked} onClick={() => void toggleLike()} className={`${action} ${liked ? "text-green" : ""} disabled:cursor-default`}>
                            <Heart size={14} aria-hidden fill={liked ? "currentColor" : "none"} />
                            <span className="sr-only">{vi ? "Thích" : "Like"}</span>
                            {likes}
                        </button>
                        {signedIn ? (
                            <button type="button" onClick={() => setReplying((open) => !open)} className={action}>
                                <MessageSquareReply size={14} aria-hidden /> {vi ? "Trả lời" : "Reply"}
                            </button>
                        ) : null}
                        {comment.mine ? (
                            <button type="button" onClick={() => setEditing(true)} className={action}>
                                <Pencil size={14} aria-hidden /> {vi ? "Sửa" : "Edit"}
                            </button>
                        ) : null}
                        {comment.mine || isAdmin ? (
                            <button type="button" onClick={() => void remove()} className={`${action} hover:text-red-700`}>
                                <Trash2 size={14} aria-hidden /> {vi ? "Xóa" : "Delete"}
                            </button>
                        ) : null}
                    </div>
                ) : null}
                {error ? (
                    <p role="alert" className="m-0 text-sm text-red-700">
                        {error}
                    </p>
                ) : null}
                {replying ? (
                    <div className="mt-2">
                        <Composer
                            autoFocus
                            initial={reply ? `@${name} ` : ""}
                            placeholder={vi ? `Trả lời ${name}` : `Reply to ${name}`}
                            submitLabel={vi ? "Gửi trả lời" : "Send reply"}
                            onCancel={() => setReplying(false)}
                            onSubmit={async (body) => {
                                await onReply(comment, body);
                                setReplying(false);
                            }}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

/** Khu bình luận: bình luận gốc, trả lời một tầng, thích, sửa, xóa, sắp theo mới nhất hoặc nổi bật. */
export default function ArticleComments(): JSX.Element {
    const { locale } = useLocale();
    const vi = locale === "vi";
    const { slug, signedIn, stats, setCommentCount } = useArticleEngagement();
    const [sort, setSort] = useState<Sort>("new");
    const [threads, setThreads] = useState<ArticleThread[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(
        async (nextPage: number, replace: boolean): Promise<void> => {
            setLoading(true);
            setError("");
            try {
                const result = await listArticleComments(slug, sort, nextPage);
                setThreads((current) => (replace ? result.items : [...current, ...result.items]));
                setPage(result.page);
                setTotal(result.total);
            } catch {
                setError(vi ? "Chưa tải được bình luận." : "Could not load comments.");
            } finally {
                setLoading(false);
            }
        },
        [slug, sort, vi],
    );

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- tải lại khi đổi cách sắp xếp
        void load(1, true);
    }, [load]);

    /** Tải lại trang đầu và cập nhật số bình luận ở thanh meta. */
    const refresh = useCallback(async (): Promise<void> => {
        await load(1, true);
        try {
            setCommentCount((await getArticleStats(slug)).comments);
        } catch {
            /* số trên thanh meta cập nhật ở lần tải sau */
        }
    }, [load, slug, setCommentCount]);

    async function addRoot(body: string): Promise<void> {
        await createArticleComment(slug, body);
        await refresh();
    }

    async function addReply(parent: ArticleComment, body: string): Promise<void> {
        await createArticleComment(slug, body, parent.id);
        await refresh();
    }

    const hasMore = threads.length < total;
    return (
        <section id="binh-luan" aria-labelledby="binh-luan-tieu-de" className="scroll-mt-20 border-t border-charcoal/15 pt-8 font-serif">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="binh-luan-tieu-de" className="m-0 text-2xl font-semibold">
                    {vi ? "Bình luận" : "Comments"} <span className="text-charcoal/55">({stats.comments})</span>
                </h2>
                <div role="radiogroup" aria-label={vi ? "Sắp xếp bình luận" : "Sort comments"} className="flex gap-1 font-sans">
                    {([
                        ["new", vi ? "Mới nhất" : "Newest"],
                        ["top", vi ? "Nổi bật" : "Top"],
                    ] as Array<[Sort, string]>).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={sort === id}
                            onClick={() => setSort(id)}
                            className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${sort === id ? "border-green bg-green/10 text-green" : "border-charcoal/20 bg-white text-charcoal/80"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-4 font-sans">
                {signedIn ? (
                    <Composer placeholder={vi ? "Viết bình luận của bạn…" : "Write a comment…"} submitLabel={vi ? "Gửi bình luận" : "Post comment"} onSubmit={addRoot} />
                ) : (
                    <p className="m-0 rounded-xl bg-white p-4 text-sm">
                        <Link href="/auth/login" className="font-semibold text-green">
                            {vi ? "Đăng nhập" : "Sign in"}
                        </Link>{" "}
                        {vi ? "để bình luận, trả lời và bình chọn." : "to comment, reply and vote."}
                    </p>
                )}
            </div>

            {error ? (
                <p role="alert" className="mt-4 mb-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
            <ul className="m-0 mt-6 grid list-none gap-6 p-0">
                {threads.map((thread) => (
                    <li key={thread.id}>
                        <CommentItem comment={thread} reply={false} onReply={addReply} onChanged={() => void refresh()} />
                        {thread.replies.length > 0 ? (
                            <ul className="m-0 mt-4 ml-5 grid list-none gap-4 border-l border-charcoal/15 p-0 pl-5 sm:ml-12">
                                {thread.replies.map((child) => (
                                    <li key={child.id}>
                                        <CommentItem comment={child} reply onReply={(_, body) => addReply(thread, body)} onChanged={() => void refresh()} />
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </li>
                ))}
            </ul>
            {!loading && threads.length === 0 && !error ? (
                <p className="mt-6 mb-0 text-sm text-charcoal/65">{vi ? "Chưa có bình luận nào. Hãy là người đầu tiên." : "No comments yet. Be the first."}</p>
            ) : null}
            {loading ? (
                <p role="status" className="mt-6 mb-0 flex items-center gap-2 text-sm text-charcoal/65">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> {vi ? "Đang tải bình luận…" : "Loading comments…"}
                </p>
            ) : null}
            {hasMore && !loading ? (
                <button type="button" onClick={() => void load(page + 1, false)} className="mt-6 min-h-10 rounded-full border border-charcoal/25 bg-white px-5 font-sans text-sm font-semibold">
                    {vi ? "Xem thêm bình luận" : "Load more comments"}
                </button>
            ) : null}
        </section>
    );
}
