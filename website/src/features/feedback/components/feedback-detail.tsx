"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type JSX } from "react";

import { Lightbox } from "@/features/messaging/components/lightbox";
import { PersonAvatar } from "@/features/messaging/components/person-avatar";
import { fullTime } from "@/features/messaging/messaging.format";

import {
    CATEGORY_LABEL,
    STATUS_LABEL,
    errorText,
    getAny,
    getMine,
    replyAdmin,
    replyMine,
    setStatus,
    type FeedbackDetail,
    type FeedbackStatus,
} from "../feedback.api";
import { StatusChip } from "./feedback-list";

export function FeedbackThread({
    id,
    mode,
    backHref,
    onChanged,
}: {
    id: string;
    mode: "user" | "admin";
    backHref: string;
    onChanged: () => void;
}): JSX.Element {
    const [state, setState] = useState<{ id: string; data: FeedbackDetail | null; error: string } | null>(null);
    const [body, setBody] = useState("");
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState("");
    const [zoom, setZoom] = useState<number | null>(null);
    const end = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        (mode === "admin" ? getAny(id) : getMine(id))
            .then((data) => {
                if (active) setState({ id, data, error: "" });
            })
            .catch((error: unknown) => {
                if (active) setState({ id, data: null, error: errorText(error, "Không tải được góp ý.") });
            });
        return () => {
            active = false;
        };
    }, [id, mode]);

    const ready = state?.id === id;
    const data = ready ? state.data : null;
    const lastReply = data?.replies.at(-1)?.id;

    useEffect(() => {
        if (lastReply) end.current?.scrollIntoView({ block: "nearest" });
    }, [lastReply]);

    async function send(): Promise<void> {
        const text = body.trim();
        if (!text || pending) return;
        setPending(true);
        setNotice("");
        try {
            const next = await (mode === "admin" ? replyAdmin(id, text) : replyMine(id, text));
            setState({ id, data: next, error: "" });
            setBody("");
            onChanged();
        } catch (error) {
            setNotice(errorText(error));
        } finally {
            setPending(false);
        }
    }

    async function changeStatus(status: FeedbackStatus): Promise<void> {
        try {
            const next = await setStatus(id, status);
            setState({ id, data: next, error: "" });
            onChanged();
        } catch (error) {
            setNotice(errorText(error));
        }
    }

    if (!ready) return <p className="m-0 p-6 text-sm" role="status">Đang tải…</p>;
    if (!data) {
        return (
            <div className="p-6">
                <p role="alert" className="m-0 text-sm">
                    {state?.error}
                </p>
                <Link href={backHref} className="mt-3 inline-block font-semibold underline">
                    Quay lại danh sách
                </Link>
            </div>
        );
    }

    const closed = data.status === "closed";
    const images = data.media.filter((item) => item.kind === "image");

    return (
        <article className="flex h-full min-h-0 flex-col" aria-label="Chi tiết góp ý">
            <header className="flex flex-wrap items-center gap-3 border-b border-charcoal/10 px-4 py-3 sm:px-6">
                <Link
                    href={backHref}
                    className="inline-flex size-11 items-center justify-center rounded-full hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green md:hidden"
                    aria-label="Quay lại danh sách"
                >
                    <ArrowLeft className="size-5" aria-hidden="true" />
                </Link>
                <div className="min-w-0 flex-1">
                    <h1 className="m-0 text-lg font-semibold">{CATEGORY_LABEL[data.category]}</h1>
                    <p className="m-0 text-xs text-charcoal/65">
                        {mode === "admin" ? `${data.author.displayName} · ` : ""}
                        {fullTime(data.createdAt)}
                    </p>
                </div>
                {mode === "admin" ? (
                    <label className="flex items-center gap-2 text-sm font-semibold">
                        Trạng thái
                        <select
                            value={data.status}
                            onChange={(event) => void changeStatus(event.target.value as FeedbackStatus)}
                            className="min-h-11 rounded-xl border border-charcoal/25 bg-white px-2 font-normal focus-visible:outline-2 focus-visible:outline-green"
                        >
                            {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((key) => (
                                <option key={key} value={key}>
                                    {STATUS_LABEL[key]}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : (
                    <StatusChip status={data.status} />
                )}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <section className="rounded-2xl bg-white p-4">
                    <div className="mb-2 flex items-center gap-2">
                        <PersonAvatar name={data.author.displayName} url={data.author.avatarUrl} size={32} />
                        <span className="text-sm font-semibold">{mode === "admin" ? data.author.displayName : "Bạn"}</span>
                    </div>
                    <p className="m-0 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">{data.description}</p>
                    {data.media.length > 0 ? (
                        <ul className="m-0 mt-3 flex flex-wrap gap-3 p-0">
                            {data.media.map((file) => (
                                <li key={file.id} className="list-none">
                                    {file.kind === "video" ? (
                                        <video src={file.url} controls preload="metadata" className="max-h-72 max-w-full rounded-xl bg-charcoal" aria-label="Video đính kèm" />
                                    ) : (
                                        <button
                                            type="button"
                                            className="block overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                            aria-label="Xem ảnh lớn"
                                            onClick={() => setZoom(images.findIndex((item) => item.id === file.id))}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={file.url} alt="Ảnh đính kèm" className="size-28 object-cover" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </section>

                <ol className="m-0 mt-4 grid gap-3 p-0" aria-label="Trao đổi">
                    {data.replies.map((reply) => {
                        const mine = (mode === "admin") === (reply.authorRole === "admin");
                        return (
                            <li key={reply.id} className={`list-none ${mine ? "justify-self-end" : "justify-self-start"} max-w-[85%]`}>
                                <div className={`rounded-2xl px-4 py-2.5 ${mine ? "bg-green text-cream" : "border border-charcoal/10 bg-white"}`}>
                                    <p className="m-0 text-xs font-semibold opacity-80">{reply.authorName}</p>
                                    <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{reply.body}</p>
                                </div>
                                <p className={`m-0 mt-0.5 text-[11px] text-charcoal/55 ${mine ? "text-right" : ""}`}>{fullTime(reply.createdAt)}</p>
                            </li>
                        );
                    })}
                </ol>
                <div ref={end} />
            </div>

            {closed && mode === "user" ? (
                <p className="m-0 border-t border-charcoal/10 px-4 py-4 text-center text-sm text-charcoal/75">
                    Góp ý này đã đóng. Bạn có thể gửi một góp ý mới nếu cần.
                </p>
            ) : (
                <form
                    className="border-t border-charcoal/10 px-4 py-3 sm:px-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void send();
                    }}
                >
                    {notice ? (
                        <p role="alert" className="m-0 mb-2 text-sm text-red-700">
                            {notice}
                        </p>
                    ) : null}
                    <label className="sr-only" htmlFor="feedback-reply">
                        {mode === "admin" ? "Trả lời người dùng" : "Trả lời thêm"}
                    </label>
                    <div className="flex items-end gap-2">
                        <textarea
                            id="feedback-reply"
                            value={body}
                            rows={2}
                            maxLength={4000}
                            placeholder={mode === "admin" ? "Trả lời người dùng…" : "Bổ sung hoặc trả lời…"}
                            onChange={(event) => setBody(event.target.value)}
                            className="min-h-11 flex-1 resize-none rounded-2xl border border-charcoal/25 p-3 text-base focus-visible:outline-2 focus-visible:outline-green"
                        />
                        <button
                            type="submit"
                            disabled={!body.trim() || pending}
                            className="min-h-11 rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:bg-charcoal/25 disabled:text-charcoal/60"
                        >
                            {pending ? "Đang gửi…" : "Gửi"}
                        </button>
                    </div>
                </form>
            )}
            {zoom !== null && images.length > 0 ? (
                <Lightbox
                    files={images.map((item) => ({ id: item.id, contentType: item.contentType, width: 0, height: 0, url: item.url }))}
                    start={Math.max(0, zoom)}
                    onClose={() => setZoom(null)}
                />
            ) : null}
        </article>
    );
}
