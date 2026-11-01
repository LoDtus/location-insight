"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type JSX } from "react";

import { AUTH_FIELD_CLASS } from "@/app/auth/form-class";
import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    createPost,
    createTopic,
    listTopics,
    slugifyTopic,
    uploadDiscussionFile,
    type DiscussionTopic,
} from "@/features/discussions/discussions.api";

export function ProfileForumPost({ root }: { root: ShellRoot }): JSX.Element {
    const [topics, setTopics] = useState<DiscussionTopic[]>([]);
    const [topicSlug, setTopicSlug] = useState("");
    const [newName, setNewName] = useState("");
    const [kind, setKind] = useState<"question" | "note">("question");
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [fileKey, setFileKey] = useState(0);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");
    const [postedId, setPostedId] = useState("");

    useEffect(() => {
        let active = true;
        void listTopics()
            .then((page) => {
                if (!active) return;
                const open = page.items.filter((topic) => topic.status === "open");
                setTopics(open);
                if (open[0]) setTopicSlug(open[0].slug);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được chủ đề.");
            });
        return () => {
            active = false;
        };
    }, []);

    async function publish(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const images = files.filter((file) => file.type.startsWith("image/"));
        const videos = files.filter((file) => file.type === "video/mp4");
        if (videos.length > 1 || (videos.length > 0 && images.length > 0) || images.length > 4) {
            setMessage("Một bài chỉ có 4 ảnh hoặc một video.");
            return;
        }
        const named = newName.trim();
        if (!topicSlug && named.length < 3) {
            setMessage("Hãy chọn một chủ đề hoặc đặt tên chủ đề mới.");
            return;
        }
        setPending(true);
        setMessage("");
        setPostedId("");
        try {
            let slug = topicSlug;
            if (named) {
                const nextSlug = slugifyTopic(named);
                if (nextSlug.length < 3) {
                    setMessage("Tên chủ đề cần ra được slug ít nhất 3 ký tự.");
                    return;
                }
                const topic = await createTopic({ name: named, slug: nextSlug });
                slug = topic.slug;
                setTopics((current) => [topic, ...current]);
                setTopicSlug(topic.slug);
                setNewName("");
            }
            const mediaIds: string[] = [];
            for (const file of files) {
                mediaIds.push(await uploadDiscussionFile(file));
            }
            const post = await createPost({ topicSlug: slug, kind, body, mediaIds });
            setBody("");
            setFiles([]);
            setFileKey((current) => current + 1);
            setPostedId(post.id);
            setMessage("Đã đăng lên diễn đàn.");
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa đăng được bài.");
        } finally {
            setPending(false);
        }
    }

    return (
        <section className="mt-10 max-w-3xl border-t border-charcoal/15 pt-8" aria-labelledby="dang-dien-dan">
            <h2 id="dang-dien-dan" className="m-0 text-xl font-semibold">
                Đăng lên diễn đàn
            </h2>
            <p className="mt-1 mb-0 text-sm text-charcoal/70">
                Câu hỏi hoặc bài ngắn sẽ hiện trên diễn đàn. Tối đa 4 ảnh, hoặc một video.
            </p>
            <form className="mt-5 grid gap-5" onSubmit={(event) => void publish(event)}>
                <label className="grid gap-1.5 text-sm font-semibold">
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
                <label className="grid gap-1.5 text-sm font-semibold">
                    Hoặc tạo chủ đề mới
                    <input
                        className={AUTH_FIELD_CLASS}
                        value={newName}
                        maxLength={80}
                        onChange={(event) => setNewName(event.target.value)}
                    />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                    Loại bài
                    <select
                        className={AUTH_FIELD_CLASS}
                        value={kind}
                        onChange={(event) => setKind(event.target.value as "question" | "note")}
                    >
                        <option value="question">Câu hỏi</option>
                        <option value="note">Bài ngắn</option>
                    </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                    Nội dung
                    <textarea
                        className={`${AUTH_FIELD_CLASS} min-h-32 py-3`}
                        value={body}
                        maxLength={2000}
                        required
                        onChange={(event) => setBody(event.target.value)}
                    />
                    <span className="text-right text-xs font-normal text-charcoal/65">{body.length}/2000</span>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                    Ảnh hoặc một video
                    <input
                        className={AUTH_FIELD_CLASS}
                        key={fileKey}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4"
                        multiple
                        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    />
                </label>
                <button
                    type="submit"
                    className="inline-flex min-h-11 w-fit items-center bg-green px-4 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    disabled={pending}
                >
                    {pending ? "Đang đăng…" : "Đăng bài"}
                </button>
            </form>
            {message ? (
                <p role={message.startsWith("Đã ") ? "status" : "alert"} className="mt-4 mb-0 text-sm">
                    {message}{" "}
                    {postedId && root === "/app" ? (
                        <Link href={`/app/discussions/${postedId}`} className="font-semibold underline underline-offset-4">
                            Xem bài vừa đăng
                        </Link>
                    ) : null}
                </p>
            ) : null}
        </section>
    );
}
