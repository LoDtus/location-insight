"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";
import { PostCard, readSavedPosts, writeSavedPosts } from "@/features/discussions/components/post-card";
import {
    createPost,
    deletePost,
    likePost,
    listAuthorPosts,
    unlikePost,
    type DiscussionPost,
} from "@/features/discussions/discussions.api";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

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
    const [saved, setSaved] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (): Promise<void> => {
        const page = await listAuthorPosts(username);
        setPosts(page.items);
    }, [username]);

    useEffect(() => {
        setSaved(readSavedPosts());
        let active = true;
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

    function toggleSaved(id: string): void {
        const next = saved.includes(id) ? saved.filter((item) => item !== id) : [id, ...saved];
        setSaved(next);
        writeSavedPosts(next);
    }

    return (
        <section className="mt-10" aria-labelledby="bai-dang">
            <h2 id="bai-dang" className="m-0 text-lg font-semibold">
                Bài đăng
            </h2>
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
                            saved={saved.includes(post.id)}
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
                            onSave={() => toggleSaved(post.id)}
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
        </section>
    );
}
