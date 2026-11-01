"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";
import {
    createPost,
    deletePost,
    getThread,
    likePost,
    replyToPost,
    unlikePost,
    uploadDiscussionFile,
    type DiscussionPost,
} from "@/features/discussions/discussions.api";
import { PostCard, readSavedPosts, writeSavedPosts } from "@/features/discussions/components/post-card";
import { PostComposer } from "@/features/discussions/components/post-composer";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

export function ThreadScreen({ id, root }: { id: string; root: ShellRoot }): JSX.Element {
    const auth = useAuth();
    const router = useRouter();
    const scroller = useRef<HTMLElement>(null);
    const sentinel = useRef<HTMLDivElement>(null);
    const loadingMore = useRef(false);
    const [post, setPost] = useState<DiscussionPost | null>(null);
    const [replies, setReplies] = useState<DiscussionPost[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [quote, setQuote] = useState<DiscussionPost | null>(null);
    const [saved, setSaved] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);
    const replyRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async (): Promise<void> => {
        const thread = await getThread(id);
        setPost(thread.post);
        setReplies(thread.replies);
        setCursor(thread.nextCursor);
    }, [id]);

    useEffect(() => {
        setSaved(readSavedPosts());
        let active = true;
        void load().catch((error: unknown) => {
            if (!active) return;
            setMessage(error instanceof AuthApiError ? error.message : "Chưa mở được mạch bài.");
        });
        return () => {
            active = false;
        };
    }, [load]);

    const loadMore = useCallback(async (): Promise<void> => {
        if (!cursor || loadingMore.current) return;
        loadingMore.current = true;
        try {
            const next = await getThread(id, cursor);
            setReplies((current) => {
                const seen = new Set(current.map((item) => item.id));
                return [...current, ...next.replies.filter((item) => !seen.has(item.id))];
            });
            setCursor(next.nextCursor);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa tải thêm được.");
        } finally {
            loadingMore.current = false;
        }
    }, [cursor, id]);

    useEffect(() => {
        const root = scroller.current;
        const target = sentinel.current;
        if (!root || !target || !cursor) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) void loadMore();
            },
            { root, rootMargin: "240px" },
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [cursor, loadMore]);

    function applyLike(target: DiscussionPost, likeCount: number, likedByMe: boolean): void {
        const next = (item: DiscussionPost): DiscussionPost =>
            item.id === target.id ? { ...item, likeCount, likedByMe } : item;
        setPost((current) => (current ? next(current) : current));
        setReplies((current) => current.map(next));
    }

    async function toggleLike(target: DiscussionPost): Promise<void> {
        const next = target.likedByMe ? await unlikePost(target.id) : await likePost(target.id);
        applyLike(target, next.likeCount, !target.likedByMe);
    }

    function toggleSaved(postId: string): void {
        const next = saved.includes(postId) ? saved.filter((item) => item !== postId) : [postId, ...saved];
        setSaved(next);
        writeSavedPosts(next);
        setMessage(next.includes(postId) ? "Đã lưu. Chỉ mình bạn thấy bài đã lưu trên trình duyệt này." : "Đã bỏ lưu.");
    }

    async function share(target: DiscussionPost): Promise<void> {
        await navigator.clipboard.writeText(`${window.location.origin}${root}/feed/${target.id}`);
        setMessage("Đã sao chép liên kết.");
    }

    async function sendReply(): Promise<void> {
        setPending(true);
        setMessage("");
        try {
            const mediaIds: string[] = [];
            for (const file of files) mediaIds.push(await uploadDiscussionFile(file));
            const text = quote ? `${body.trim()}\n\nTrích ${quote.authorName}: ${quote.body}`.trim() : body.trim();
            await replyToPost(id, { body: text, mediaIds });
            setBody("");
            setFiles([]);
            setQuote(null);
            await load();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa gửi được trả lời.");
        } finally {
            setPending(false);
        }
    }

    if (!post) {
        return (
            <main className={`h-full overflow-auto ${root === "/admin" ? "bg-white" : "bg-cream"}`}>
                <p className="m-0 px-4 py-8 text-sm">{message || "Đang tải mạch bài."}</p>
            </main>
        );
    }

    const items = [post, ...replies];

    return (
        <main ref={scroller} className={`h-full overflow-auto ${root === "/admin" ? "bg-white" : "bg-cream"}`}>
            <div className="mx-auto min-h-full w-full max-w-[640px] border-x border-charcoal/10 bg-white">
                <p className="m-0 border-b border-charcoal/10 px-4 py-3 text-sm">
                    <Link href={`${root}/feed`} className="font-semibold text-green no-underline">
                        Diễn đàn
                    </Link>
                </p>
                {message ? (
                    <p role="status" className="m-0 border-b border-charcoal/10 px-4 py-3 text-sm">
                        {message}
                    </p>
                ) : null}
                <ol className="m-0 list-none p-0">
                    {items.map((item, index) => (
                        <li key={item.id}>
                            <PostCard
                                post={item}
                                root={root}
                                connected={index < items.length - 1}
                                saved={saved.includes(item.id)}
                                mine={auth.user?.userId === item.authorId}
                                onLike={() => void toggleLike(item).catch(() => setMessage("Chưa thích được."))}
                                onReply={() => replyRef.current?.scrollIntoView({ block: "nearest" })}
                                onRepost={() => {
                                    void createPost({
                                        topicSlug: item.topicSlug,
                                        kind: "note",
                                        body: `Đăng lại từ @${item.authorUsername ?? item.authorName}:\n${item.body}`,
                                    })
                                        .then(() => setMessage("Đã đăng lại lên diễn đàn."))
                                        .catch(() => setMessage("Chưa đăng lại được."));
                                }}
                                onQuote={() => {
                                    setQuote(item);
                                    replyRef.current?.scrollIntoView({ block: "nearest" });
                                }}
                                onShare={() => void share(item).catch(() => setMessage("Chưa sao chép được liên kết."))}
                                onSave={() => toggleSaved(item.id)}
                                onDelete={() => {
                                    void getConfirmModal({
                                        title: "Xóa bài",
                                        content: "Bài này sẽ không còn hiện trên diễn đàn.",
                                        okText: "Xóa",
                                        cancelText: "Huỷ",
                                    }).then((accepted) => {
                                        if (!accepted) return;
                                        void deletePost(item.id)
                                            .then(() => {
                                                if (item.id === post.id) router.push(`${root}/feed`);
                                                else void load();
                                            })
                                            .catch(() => setMessage("Chưa xóa được."));
                                    });
                                }}
                            />
                        </li>
                    ))}
                </ol>
                <div ref={sentinel} className="h-8" />
                <div ref={replyRef} className="border-t border-charcoal/10">
                    <PostComposer
                        displayName={auth.user?.displayName ?? "Bạn"}
                        avatarUrl={auth.user?.avatarUrl}
                        placeholder={`Trả lời ${post.authorName}`}
                        body={body}
                        onBody={setBody}
                        files={files}
                        onFiles={setFiles}
                        pending={pending}
                        submitLabel="Trả lời"
                        quote={quote ? { author: quote.authorName, body: quote.body } : null}
                        onClearQuote={() => setQuote(null)}
                        onSubmit={() => void sendReply()}
                    />
                </div>
            </div>
        </main>
    );
}
