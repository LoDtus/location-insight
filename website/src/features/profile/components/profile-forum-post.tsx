"use client";

import Link from "next/link";
import { useEffect, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";
import { fullTime } from "@/features/discussions/components/post-card";
import { PostComposer, type ComposerDraft } from "@/features/discussions/components/post-composer";
import { listTopics, type DiscussionTopic } from "@/features/discussions/discussions.api";
import { DraftError, publishDraft } from "@/features/discussions/publish-draft";

export function ProfileForumPost({ root, onPosted }: { root: ShellRoot; onPosted?: () => void }): JSX.Element {
    const auth = useAuth();
    const [topics, setTopics] = useState<DiscussionTopic[]>([]);
    const [message, setMessage] = useState("");
    const [postedId, setPostedId] = useState("");

    useEffect(() => {
        let active = true;
        void listTopics()
            .then((page) => {
                if (active) setTopics(page.items.filter((topic) => topic.status === "open"));
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được chủ đề.");
            });
        return () => {
            active = false;
        };
    }, []);

    async function publish(draft: ComposerDraft): Promise<boolean> {
        setMessage("");
        setPostedId("");
        try {
            const { post, createdTopic } = await publishDraft(draft, topics);
            if (createdTopic) setTopics((current) => [createdTopic, ...current]);
            setPostedId(post.id);
            setMessage(post.scheduledFor ? `Đã lên lịch đăng lúc ${fullTime(post.scheduledFor)}.` : "Đã đăng lên diễn đàn.");
            onPosted?.();
            return true;
        } catch (error) {
            setMessage(error instanceof AuthApiError || error instanceof DraftError ? error.message : "Chưa đăng được bài.");
            return false;
        }
    }

    return (
        <section className="mt-6 max-w-[640px] overflow-hidden rounded-2xl border border-charcoal/10 bg-white" aria-labelledby="dang-dien-dan">
            <h2 id="dang-dien-dan" className="m-0 border-b border-charcoal/10 px-4 py-3 text-base font-semibold">
                Đăng lên diễn đàn
            </h2>
            <PostComposer
                displayName={auth.user?.displayName ?? "Bạn"}
                avatarUrl={auth.user?.avatarUrl}
                placeholder="Có gì mới?"
                topics={topics}
                draftKey={auth.user ? `discussion-draft:${auth.user.userId}` : undefined}
                onSubmit={publish}
            />
            {message ? (
                <p role={message.startsWith("Đã ") ? "status" : "alert"} className="m-0 border-t border-charcoal/10 px-4 py-3 text-sm">
                    {message}{" "}
                    {postedId ? (
                        <Link href={`${root}/feed/${postedId}`} className="font-semibold underline underline-offset-4">
                            Xem bài vừa đăng
                        </Link>
                    ) : null}
                </p>
            ) : null}
        </section>
    );
}
