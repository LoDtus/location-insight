"use client";

import { ImagePlus } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type JSX } from "react";

import type { DiscussionTopic } from "@/features/discussions/discussions.api";

export function PostComposer({
    displayName,
    avatarUrl,
    placeholder,
    body,
    onBody,
    topics,
    topicSlug,
    onTopic,
    newTopic,
    onNewTopic,
    files,
    onFiles,
    pending,
    submitLabel = "Đăng",
    quote,
    onClearQuote,
    onSubmit,
}: {
    displayName: string;
    avatarUrl?: string | null;
    placeholder: string;
    body: string;
    onBody: (value: string) => void;
    topics?: DiscussionTopic[];
    topicSlug?: string;
    onTopic?: (slug: string) => void;
    newTopic?: string;
    onNewTopic?: (value: string) => void;
    files: File[];
    onFiles: (files: File[]) => void;
    pending: boolean;
    submitLabel?: string;
    quote?: { author: string; body: string } | null;
    onClearQuote?: () => void;
    onSubmit: () => void;
}): JSX.Element {
    const fileId = useId();
    const [previews, setPreviews] = useState<string[]>([]);

    useEffect(() => {
        const next = files.map((file) => URL.createObjectURL(file));
        setPreviews(next);
        return () => {
            for (const url of next) URL.revokeObjectURL(url);
        };
    }, [files]);

    function submit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        onSubmit();
    }

    return (
        <form className="flex gap-3 px-4 py-4" onSubmit={submit}>
            <Avatar name={displayName} url={avatarUrl} />
            <div className="min-w-0 flex-1">
                <label className="block">
                    <span className="sr-only">{placeholder}</span>
                    <textarea
                        className="min-h-16 w-full resize-none border-0 bg-transparent p-0 text-base leading-relaxed outline-none placeholder:text-charcoal/45"
                        value={body}
                        maxLength={2000}
                        placeholder={placeholder}
                        onChange={(event) => onBody(event.target.value)}
                    />
                </label>
                {quote ? (
                    <div className="mt-2 rounded-2xl border border-charcoal/15 p-3 text-sm">
                        <p className="m-0 font-semibold">{quote.author}</p>
                        <p className="mt-1 mb-0 line-clamp-3 text-charcoal/75">{quote.body}</p>
                        {onClearQuote ? (
                            <button
                                type="button"
                                className="mt-2 text-sm font-semibold text-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                onClick={onClearQuote}
                            >
                                Bỏ trích dẫn
                            </button>
                        ) : null}
                    </div>
                ) : null}
                {previews.length > 0 ? (
                    <div className={`mt-3 grid gap-1 ${previews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {previews.map((url) => (
                            // Object URLs are local previews of files the person just chose.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt="" className="max-h-60 w-full rounded-2xl object-cover" />
                        ))}
                    </div>
                ) : null}
                {topics && onTopic ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="text-sm">
                            <span className="sr-only">Chủ đề</span>
                            <select
                                className="min-h-11 rounded-full border border-charcoal/15 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                value={topicSlug ?? ""}
                                onChange={(event) => onTopic(event.target.value)}
                            >
                                <option value="">Chọn chủ đề</option>
                                {topics.map((topic) => (
                                    <option key={topic.id} value={topic.slug}>
                                        {topic.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {onNewTopic ? (
                            <input
                                className="min-h-11 min-w-40 flex-1 rounded-full border border-charcoal/15 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                value={newTopic ?? ""}
                                maxLength={80}
                                placeholder="Hoặc chủ đề mới"
                                onChange={(event) => onNewTopic(event.target.value)}
                            />
                        ) : null}
                    </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-3">
                    <label
                        htmlFor={fileId}
                        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-green hover:bg-green/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green"
                    >
                        <span className="sr-only">Thêm ảnh hoặc một video</span>
                        <ImagePlus className="size-5" aria-hidden="true" />
                        <input
                            id={fileId}
                            className="sr-only"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,video/mp4"
                            multiple
                            onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
                        />
                    </label>
                    <button
                        type="submit"
                        className="inline-flex min-h-11 items-center rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={pending || (body.trim().length === 0 && !quote)}
                    >
                        {pending ? "Đang đăng" : submitLabel}
                    </button>
                </div>
            </div>
        </form>
    );
}

export function Avatar({
    name,
    url,
    online = false,
}: {
    name: string;
    url?: string | null;
    /** Chấm xanh góc dưới phải: đang trực tuyến. */
    online?: boolean;
}): JSX.Element {
    const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
    const letter = (parts.at(-1) ?? "?").slice(0, 1).toUpperCase();
    return (
        <span className="relative inline-flex size-10 shrink-0">
            {url ? (
                // Profile photos are remote and may be signed.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="size-10 rounded-full object-cover" />
            ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-green text-sm font-semibold text-cream">{letter}</span>
            )}
            {online ? (
                <span
                    role="img"
                    aria-label="Đang trực tuyến"
                    title="Đang trực tuyến"
                    className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full bg-[#22c55e] ring-[2.5px] ring-white"
                />
            ) : null}
        </span>
    );
}
