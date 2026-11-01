"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    createPost,
    createTopic,
    listPosts,
    listTopics,
    slugifyTopic,
    topicFeed,
    uploadDiscussionFile,
    type DiscussionPost,
    type DiscussionTopic,
} from "@/features/discussions/discussions.api";

const KIND_LABEL = {
    question: "Câu hỏi",
    note: "Bài ngắn",
    reply: "Trả lời",
} as const;

export function FeedScreen() {
    const [topics, setTopics] = useState<DiscussionTopic[]>([]);
    const [posts, setPosts] = useState<DiscussionPost[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [topicSlug, setTopicSlug] = useState("");
    const [kind, setKind] = useState<"question" | "note">("question");
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [newName, setNewName] = useState("");
    const [filter, setFilter] = useState("");
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    async function load(nextFilter = filter): Promise<void> {
        const [topicPage, postPage] = await Promise.all([
            listTopics(),
            nextFilter ? topicFeed(nextFilter) : listPosts(),
        ]);
        setTopics(topicPage.items);
        setPosts(postPage.items);
        setCursor(postPage.nextCursor);
        if (!topicSlug && topicPage.items[0]) setTopicSlug(topicPage.items[0].slug);
    }

    useEffect(() => {
        let active = true;
        void load()
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được diễn đàn.");
            });
        return () => {
            active = false;
        };
        // The first load uses the empty filter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function onCreateTopic(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const slug = slugifyTopic(newName);
        if (slug.length < 3) {
            setMessage("Tên chủ đề cần ra được slug ít nhất 3 ký tự.");
            return;
        }
        setPending(true);
        setMessage("");
        try {
            const topic = await createTopic({ name: newName.trim(), slug });
            setNewName("");
            setTopicSlug(topic.slug);
            await load();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa tạo được chủ đề.");
        } finally {
            setPending(false);
        }
    }

    async function onPost(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!topicSlug) {
            setMessage("Hãy chọn hoặc tạo một chủ đề.");
            return;
        }
        const images = files.filter((file) => file.type.startsWith("image/"));
        const videos = files.filter((file) => file.type === "video/mp4");
        if (videos.length > 1 || (videos.length > 0 && images.length > 0) || images.length > 4) {
            setMessage("Một bài chỉ có 4 ảnh hoặc một video.");
            return;
        }
        setPending(true);
        setMessage("");
        try {
            const mediaIds: string[] = [];
            for (const file of files) {
                mediaIds.push(await uploadDiscussionFile(file));
            }
            await createPost({ topicSlug, kind, body, mediaIds });
            setBody("");
            setFiles([]);
            await load();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa đăng được bài.");
        } finally {
            setPending(false);
        }
    }

    return (
        <main className="box-border flex flex-col gap-8 px-4 py-8 sm:px-8">
            <section className={AUTH_FORM_CLASS}>
                <h1 className={AUTH_TITLE_CLASS}>Hỏi về một khu</h1>
                <p className="m-0 text-sm leading-relaxed">
                    Đăng một câu hỏi hoặc một bài ngắn trong một chủ đề. Người khác trả lời bên dưới bài đó.
                </p>
                {message ? (
                    <p role="alert" className="m-0 text-sm">
                        {message}
                    </p>
                ) : null}
                <form className="flex flex-col gap-3" onSubmit={(event) => void onCreateTopic(event)}>
                    <label className={AUTH_LABEL_CLASS}>
                        Chủ đề mới
                        <input
                            className={AUTH_FIELD_CLASS}
                            value={newName}
                            maxLength={80}
                            onChange={(event) => setNewName(event.target.value)}
                        />
                    </label>
                    <button className={AUTH_BUTTON_CLASS} type="submit" disabled={pending}>
                        Tạo chủ đề
                    </button>
                </form>
                <form className="flex flex-col gap-3" onSubmit={(event) => void onPost(event)}>
                    <label className={AUTH_LABEL_CLASS}>
                        Chủ đề
                        <select
                            className={AUTH_FIELD_CLASS}
                            value={topicSlug}
                            onChange={(event) => setTopicSlug(event.target.value)}
                        >
                            <option value="">Chọn chủ đề</option>
                            {topics.map((topic) => (
                                <option key={topic.id} value={topic.slug}>
                                    {topic.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={AUTH_LABEL_CLASS}>
                        Loại
                        <select
                            className={AUTH_FIELD_CLASS}
                            value={kind}
                            onChange={(event) => setKind(event.target.value as "question" | "note")}
                        >
                            <option value="question">Câu hỏi</option>
                            <option value="note">Bài ngắn</option>
                        </select>
                    </label>
                    <label className={AUTH_LABEL_CLASS}>
                        Nội dung
                        <textarea
                            className={AUTH_FIELD_CLASS}
                            value={body}
                            maxLength={2000}
                            required
                            onChange={(event) => setBody(event.target.value)}
                        />
                    </label>
                    <label className={AUTH_LABEL_CLASS}>
                        Ảnh hoặc một video
                        <input
                            className={AUTH_FIELD_CLASS}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,video/mp4"
                            multiple
                            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                        />
                    </label>
                    <p className="m-0 text-sm">Tối đa 4 ảnh, hoặc một video. Không đăng cả hai.</p>
                    <button className={AUTH_BUTTON_CLASS} type="submit" disabled={pending}>
                        {pending ? "Đang đăng" : "Đăng"}
                    </button>
                </form>
            </section>
            <nav className="flex flex-wrap gap-2" aria-label="Chủ đề">
                <button
                    className="min-h-11 border border-current px-3 font-semibold"
                    type="button"
                    aria-current={filter === "" ? "page" : undefined}
                    onClick={() => {
                        setFilter("");
                        void load("").catch((error: unknown) => {
                            setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được.");
                        });
                    }}
                >
                    Mới nhất
                </button>
                {topics.map((topic) => (
                    <button
                        key={topic.id}
                        className="min-h-11 border border-current px-3 font-semibold"
                        type="button"
                        aria-current={filter === topic.slug ? "page" : undefined}
                        onClick={() => {
                            setFilter(topic.slug);
                            void load(topic.slug).catch((error: unknown) => {
                                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được.");
                            });
                        }}
                    >
                        {topic.name}
                    </button>
                ))}
            </nav>
            {posts.length === 0 ? (
                <p className="m-0 text-sm">Chủ đề này chưa có câu hỏi. Hãy đăng câu hỏi đầu tiên ở ô phía trên.</p>
            ) : (
                <ol className="m-0 flex list-none flex-col gap-6 p-0">
                    {posts.map((post) => (
                        <li key={post.id} className="border-t border-current pt-4">
                            <p className="m-0 text-sm">
                                {post.authorName} · {post.topicName} · {KIND_LABEL[post.kind]} ·{" "}
                                {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                            </p>
                            <h2 className="mt-1 mb-0 text-lg font-semibold">
                                <Link href={`/app/discussions/${post.id}`}>{post.body.slice(0, 80)}</Link>
                            </h2>
                            <p className="mt-2 mb-0 text-sm leading-relaxed">{post.body}</p>
                            {post.media[0] ? <MediaItem media={post.media[0]} /> : null}
                            <p className="mt-2 mb-0 text-sm">
                                {post.replyCount} trả lời · {post.likeCount} lượt thích
                            </p>
                        </li>
                    ))}
                </ol>
            )}
            {cursor ? (
                <button
                    className="min-h-11 w-fit border border-current px-3 font-semibold"
                    type="button"
                    onClick={() => {
                        const request = filter ? topicFeed(filter, cursor) : listPosts(cursor);
                        void request
                            .then((page) => {
                                setPosts((current) => [...current, ...page.items]);
                                setCursor(page.nextCursor);
                            })
                            .catch((error: unknown) => {
                                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải thêm được.");
                            });
                    }}
                >
                    Tải thêm
                </button>
            ) : null}
        </main>
    );
}

function MediaItem({ media }: { media: DiscussionPost["media"][number] }) {
    if (media.kind === "video") {
        return <video className="mt-3 max-h-80 w-full" controls src={media.url} />;
    }
    return (
        // Signed URLs are temporary and not known at build time.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mt-3 max-h-80 w-full object-cover" src={media.url} alt="" />
    );
}
