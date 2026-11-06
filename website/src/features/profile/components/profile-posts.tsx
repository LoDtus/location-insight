"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";
import { PostCard } from "@/features/discussions/components/post-card";
import { usePostActions } from "@/features/discussions/components/use-post-actions";
import {
    createPost,
    deletePost,
    likePost,
    listAuthorPosts,
    unlikePost,
    type AuthorPostSort,
    type DiscussionPost,
} from "@/features/discussions/discussions.api";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

function readAuthorSort(value: string): AuthorPostSort {
    if (value === "interactions" || value === "oldest") return value;
    return "newest";
}

export function ProfilePosts({
    username,
    root,
    reloadKey,
}: {
    username: string;
    root: ShellRoot;
    reloadKey: number;
}): JSX.Element {
    const auth = useAuth();
    const router = useRouter();
    const [posts, setPosts] = useState<DiscussionPost[]>([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<AuthorPostSort>("newest");

    const load = useCallback(async (): Promise<void> => {
        const page = await listAuthorPosts(username, undefined, sort);
        setPosts(page.items);
    }, [username, sort]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        void load()
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được bài đăng.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [load, reloadKey]);

    async function toggleLike(post: DiscussionPost): Promise<void> {
        const next = post.likedByMe ? await unlikePost(post.id) : await likePost(post.id);
        setPosts((current) =>
            current.map((item) => (item.id === post.id ? { ...item, likedByMe: !post.likedByMe, likeCount: next.likeCount } : item)),
        );
    }

    const actions = usePostActions({
        root,
        onSaved: (postId, value) => setPosts((current) => current.map((item) => (item.id === postId ? { ...item, savedByMe: value } : item))),
        onBlocked: (authorId) => setPosts((current) => current.filter((item) => item.authorId !== authorId)),
    });

    return (
        <section className="mt-8" aria-labelledby="bai-dang">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="bai-dang" className="m-0 text-lg font-semibold">
                    Bài đăng
                </h2>
                <label className="text-sm">
                    <span className="sr-only">Sắp xếp bài đăng</span>
                    <select
                        className="min-h-11 rounded-full border border-charcoal/15 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        value={sort}
                        onChange={(event) => setSort(readAuthorSort(event.target.value))}
                    >
                        <option value="newest">Mới nhất</option>
                        <option value="interactions">Tương tác nhiều nhất</option>
                        <option value="oldest">Lâu nhất</option>
                    </select>
                </label>
            </div>
            {message ? (
                <p role="alert" className="mt-3 mb-0 text-sm">
                    {message}
                </p>
            ) : null}
            {loading ? <p className="mt-3 mb-0 text-sm">Đang tải bài đăng.</p> : null}
            {!loading && posts.length === 0 ? <p className="mt-3 mb-0 text-sm">Chưa có bài đăng.</p> : null}
            {posts.length > 0 ? (
            <ol className="m-0 mt-3 list-none overflow-hidden rounded-2xl border border-charcoal/10 bg-white p-0">
                {posts.map((post) => (
                    <li key={post.id} className="border-t border-charcoal/10 first:border-t-0">
                        <PostCard
                            post={post}
                            root={root}
                            mine={auth.user?.userId === post.authorId}
                            onLike={() => void toggleLike(post).catch(() => setMessage("Chưa thích được."))}
                            onReply={() => router.push(`${root}/feed/${post.id}`)}
                            onRepost={() => {
                                void createPost({
                                    topicSlug: post.topicSlug,
                                    kind: "note",
                                    body: `Đăng lại từ @${post.authorUsername ?? post.authorName}:\n${post.body}`,
                                })
                                    .then(() => setMessage("Đã đăng lại lên diễn đàn."))
                                    .catch(() => setMessage("Chưa đăng lại được."));
                            }}
                            onQuote={() => router.push(`${root}/feed/${post.id}`)}
                            onShare={() => {
                                void navigator.clipboard
                                    .writeText(`${window.location.origin}${root}/feed/${post.id}`)
                                    .then(() => setMessage("Đã sao chép liên kết."))
                                    .catch(() => setMessage("Chưa sao chép được liên kết."));
                            }}
                            onSave={() => actions.toggleSave(post)}
                            onReport={() => actions.report(post)}
                            onBlock={() => actions.block(post)}
                            onCopyLink={() => actions.copyLink(post)}
                            onDelete={() => {
                                void getConfirmModal({
                                    title: "Xóa bài",
                                    content: "Bài này sẽ không còn hiện trên diễn đàn.",
                                    okText: "Xóa",
                                    cancelText: "Huỷ",
                                }).then((accepted) => {
                                    if (!accepted) return;
                                    void deletePost(post.id)
                                        .then(() => setPosts((current) => current.filter((item) => item.id !== post.id)))
                                        .catch(() => setMessage("Chưa xóa được."));
                                });
                            }}
                        />
                    </li>
                ))}
            </ol>
            ) : null}
            {actions.dialog}
        </section>
    );
}
