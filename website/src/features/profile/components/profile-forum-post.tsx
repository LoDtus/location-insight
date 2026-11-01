"use client";

import Link from "next/link";
import { useEffect, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";
import { PostComposer } from "@/features/discussions/components/post-composer";
import {
    createPost,
    createTopic,
    listTopics,
    slugifyTopic,
    uploadDiscussionFile,
    type DiscussionTopic,
} from "@/features/discussions/discussions.api";

export function ProfileForumPost({ root }: { root: ShellRoot }): JSX.Element {
    const auth = useAuth();
    const [topics, setTopics] = useState<DiscussionTopic[]>([]);
    const [topicSlug, setTopicSlug] = useState("");
    const [newName, setNewName] = useState("");
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
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

    async function publish(): Promise<void> {
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
            const post = await createPost({ topicSlug: slug, kind: "note", body, mediaIds });
            setBody("");
            setFiles([]);
            setPostedId(post.id);
            setMessage("Đã đăng lên diễn đàn.");
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa đăng được bài.");
        } finally {
            setPending(false);
        }
    }

    return (
        <section className="mt-10 max-w-[640px] overflow-hidden rounded-2xl border border-charcoal/10 bg-white" aria-labelledby="dang-dien-dan">
            <h2 id="dang-dien-dan" className="m-0 border-b border-charcoal/10 px-4 py-3 text-base font-semibold">
                Đăng lên diễn đàn
            </h2>
            <PostComposer
                displayName={auth.user?.displayName ?? "Bạn"}
                avatarUrl={auth.user?.avatarUrl}
                placeholder="Có gì mới?"
                body={body}
                onBody={setBody}
                topics={topics}
                topicSlug={topicSlug}
                onTopic={setTopicSlug}
                newTopic={newName}
                onNewTopic={setNewName}
                files={files}
                onFiles={setFiles}
                pending={pending}
                onSubmit={() => void publish()}
            />
            {message ? (
                <p role={message.startsWith("Đã ") ? "status" : "alert"} className="m-0 border-t border-charcoal/10 px-4 py-3 text-sm">
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
