"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";
import {
    deletePost,
    getThread,
    likePost,
    replyToPost,
    reportPost,
    unlikePost,
    uploadDiscussionFile,
    type DiscussionPost,
} from "@/features/discussions/discussions.api";

export function ThreadScreen({ id }: { id: string }) {
    const auth = useAuth();
    const [post, setPost] = useState<DiscussionPost | null>(null);
    const [replies, setReplies] = useState<DiscussionPost[]>([]);
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [report, setReport] = useState("");
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    async function load(): Promise<void> {
        const thread = await getThread(id);
        setPost(thread.post);
        setReplies(thread.replies);
    }

    useEffect(() => {
        let active = true;
        void getThread(id)
            .then((thread) => {
                if (!active) return;
                setPost(thread.post);
                setReplies(thread.replies);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa mở được mạch bài.");
            });
        return () => {
            active = false;
        };
    }, [id]);

    async function onReply(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setPending(true);
        setMessage("");
        try {
            const mediaIds: string[] = [];
            for (const file of files) mediaIds.push(await uploadDiscussionFile(file));
            await replyToPost(id, { body, mediaIds });
            setBody("");
            setFiles([]);
            await load();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa gửi được trả lời.");
        } finally {
            setPending(false);
        }
    }

    async function toggleLike(target: DiscussionPost): Promise<void> {
        const next = target.likedByMe ? await unlikePost(target.id) : await likePost(target.id);
        const apply = (item: DiscussionPost): DiscussionPost =>
            item.id === target.id
                ? { ...item, likeCount: next.likeCount, likedByMe: !target.likedByMe }
                : item;
        setPost((current) => (current ? apply(current) : current));
        setReplies((current) => current.map(apply));
    }

    if (!post) {
        return (
            <main className="px-4 py-8 sm:px-8">
                <p className="text-sm">{message || "Đang tải mạch bài."}</p>
            </main>
        );
    }

    return (
        <main className="box-border flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
            <p className="m-0 text-sm">
                <Link href="/app/discussions">Diễn đàn</Link>
                {post.topicName ? ` · ${post.topicName}` : ""}
            </p>
            {message ? (
                <p role="alert" className="m-0 text-sm">
                    {message}
                </p>
            ) : null}
            <PostBlock
                post={post}
                mine={auth.user?.userId === post.authorId}
                onLike={() => void toggleLike(post).catch(() => setMessage("Chưa thích được."))}
                onDelete={() => {
                    void deletePost(post.id)
                        .then(() => {
                            window.location.href = "/app/discussions";
                        })
                        .catch((error: unknown) => {
                            setMessage(error instanceof AuthApiError ? error.message : "Chưa xóa được.");
                        });
                }}
            />
            <section className="flex flex-col gap-4">
                <h2 className="m-0 text-lg font-semibold">{replies.length} trả lời</h2>
                {replies.map((reply) => (
                    <PostBlock
                        key={reply.id}
                        post={reply}
                        mine={auth.user?.userId === reply.authorId}
                        onLike={() => void toggleLike(reply).catch(() => setMessage("Chưa thích được."))}
                        onDelete={() => {
                            void deletePost(reply.id)
                                .then(() => load())
                                .catch((error: unknown) => {
                                    setMessage(error instanceof AuthApiError ? error.message : "Chưa xóa được.");
                                });
                        }}
                    />
                ))}
            </section>
            <form className="flex flex-col gap-3" onSubmit={(event) => void onReply(event)}>
                <label className={AUTH_LABEL_CLASS}>
                    Trả lời mạch này
                    <textarea
                        className={AUTH_FIELD_CLASS}
                        value={body}
                        maxLength={2000}
                        required
                        onChange={(event) => setBody(event.target.value)}
                    />
                </label>
                <input
                    className={AUTH_FIELD_CLASS}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
                <button className={AUTH_BUTTON_CLASS} type="submit" disabled={pending}>
                    {pending ? "Đang gửi" : "Gửi trả lời"}
                </button>
            </form>
            <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    void reportPost(id, report)
                        .then(() => {
                            setReport("");
                            setMessage("Đã gửi báo cáo.");
                        })
                        .catch((error: unknown) => {
                            setMessage(error instanceof AuthApiError ? error.message : "Chưa báo cáo được.");
                        });
                }}
            >
                <label className={AUTH_LABEL_CLASS}>
                    Báo cáo bài gốc
                    <input
                        className={AUTH_FIELD_CLASS}
                        value={report}
                        minLength={5}
                        maxLength={500}
                        onChange={(event) => setReport(event.target.value)}
                    />
                </label>
                <button className="min-h-11 w-fit border border-current px-3 font-semibold" type="submit">
                    Gửi báo cáo
                </button>
            </form>
        </main>
    );
}

function PostBlock({
    post,
    mine,
    onLike,
    onDelete,
}: {
    post: DiscussionPost;
    mine: boolean;
    onLike: () => void;
    onDelete: () => void;
}) {
    return (
        <article className="border-t border-current pt-4">
            <h2 className={post.rootId ? "m-0 text-base font-semibold" : AUTH_TITLE_CLASS}>
                {post.parentAuthorName ? `Trả lời ${post.parentAuthorName}` : post.authorName}
            </h2>
            <p className="m-0 text-sm">
                {post.authorName} · {new Date(post.createdAt).toLocaleString("vi-VN")}
            </p>
            <p className="mt-2 mb-0 leading-relaxed">{post.body}</p>
            {post.media.map((media) =>
                media.kind === "video" ? (
                    <video key={media.id} className="mt-3 max-h-80 w-full" controls src={media.url} />
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={media.id} className="mt-3 max-h-80 w-full object-cover" src={media.url} alt="" />
                ),
            )}
            <div className="mt-3 flex flex-wrap gap-2">
                <button className="min-h-11 border border-current px-3 font-semibold" type="button" onClick={onLike}>
                    {post.likedByMe ? "Bỏ thích" : "Thích"} · {post.likeCount}
                </button>
                {mine ? (
                    <button className="min-h-11 border border-current px-3 font-semibold" type="button" onClick={onDelete}>
                        Xóa
                    </button>
                ) : null}
            </div>
        </article>
    );
}
