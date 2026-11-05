"use client";

import { CornerUpLeft, Flag, MoreHorizontal, Smile, Undo2, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type JSX } from "react";

import { clockTime, fullTime, splitLinks } from "../messaging.format";
import { REACTIONS } from "../messaging.constants";
import { FileCard } from "./file-card";
import type { Message } from "../messaging.types";

export interface BubbleProps {
    message: Message;
    mine: boolean;
    peerName: string;
    groupedWithPrevious: boolean;
    groupedWithNext: boolean;
    highlighted: boolean;
    onReply: (message: Message) => void;
    onReact: (message: Message, emoji: string) => void;
    onUnsend: (message: Message) => void;
    onReport: (message: Message) => void;
    onJump: (seq: number) => void;
    onMedia: () => void;
    onZoom: (message: Message, index: number) => void;
    root: string;
}

function Linked({ text, mine }: { text: string; mine: boolean }): JSX.Element {
    return (
        <>
            {splitLinks(text).map((part, index) =>
                part.type === "link" ? (
                    <a
                        key={index}
                        href={part.value}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className={`break-all underline underline-offset-2 ${mine ? "text-cream" : "text-green"}`}
                    >
                        {part.value}
                    </a>
                ) : (
                    <span key={index}>{part.value}</span>
                ),
            )}
        </>
    );
}

export function MessageBubble(props: BubbleProps): JSX.Element {
    const { message, mine, groupedWithPrevious, groupedWithNext, highlighted } = props;
    const [menu, setMenu] = useState<"none" | "react" | "more">("none");
    const [touched, setTouched] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const deleted = message.status === "deleted";
    const images = message.attachments.filter((item) => item.kind !== "file");
    const documents = message.attachments.filter((item) => item.kind === "file");

    useEffect(() => {
        if (menu === "none") return;
        function away(event: MouseEvent): void {
            if (event.target instanceof Node && !box.current?.contains(event.target)) setMenu("none");
        }
        function key(event: KeyboardEvent): void {
            if (event.key === "Escape") setMenu("none");
        }
        window.addEventListener("mousedown", away);
        window.addEventListener("keydown", key);
        return () => {
            window.removeEventListener("mousedown", away);
            window.removeEventListener("keydown", key);
        };
    }, [menu]);

    const radius = mine
        ? `rounded-2xl ${groupedWithPrevious ? "rounded-tr-md" : ""} ${groupedWithNext ? "rounded-br-md" : ""}`
        : `rounded-2xl ${groupedWithPrevious ? "rounded-tl-md" : ""} ${groupedWithNext ? "rounded-bl-md" : ""}`;
    const tone = deleted
        ? "border border-dashed border-charcoal/30 bg-transparent italic text-charcoal/60"
        : mine
          ? "bg-green text-cream"
          : "border border-charcoal/15 bg-white text-charcoal";
    const showActions = !deleted && (touched || menu !== "none");

    return (
        <div
            id={`msg-${message.seq}`}
            ref={box}
            className={`group flex max-w-full flex-col ${mine ? "items-end" : "items-start"} ${groupedWithPrevious ? "mt-0.5" : "mt-3"}`}
        >
            {message.replyTo && !deleted ? (
                <button
                    type="button"
                    className={`mb-0.5 max-w-[70%] truncate rounded-2xl bg-charcoal/10 px-3 py-1.5 text-left text-xs text-charcoal/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green`}
                    onClick={() => props.onJump(message.replyTo?.seq ?? 0)}
                >
                    <span className="block font-semibold">
                        {message.replyTo.senderId === message.senderId ? (mine ? "Bạn đã tự trả lời" : `${props.peerName} đã tự trả lời`) : mine ? `Bạn đã trả lời ${props.peerName}` : `${props.peerName} đã trả lời bạn`}
                    </span>
                    <span className="block truncate">{message.replyTo.excerpt}</span>
                </button>
            ) : null}
            <div className={`relative flex w-fit max-w-full flex-col gap-1 sm:flex-row sm:items-center ${mine ? "items-end" : "items-start"}`}>
                <div
                    className={`relative min-w-0 max-w-[min(70vw,34rem)] px-3.5 py-2 text-[15px] leading-snug ${radius} ${tone} ${highlighted ? "ring-2 ring-gold" : ""}`}
                    title={fullTime(message.createdAt)}
                    onClick={() => setTouched((current) => !current)}
                >
                    {deleted ? (
                        <span>{mine ? "Bạn đã thu hồi một tin nhắn" : "Tin nhắn đã thu hồi"}</span>
                    ) : (
                        <>
                            {documents.length > 0 ? (
                                <div className="mb-1 grid gap-1">
                                    {documents.map((file) => (
                                        <FileCard
                                            key={file.id}
                                            fileName={file.fileName ?? "tep"}
                                            byteSize={file.byteSize}
                                            url={file.url}
                                            tone={mine ? "mine" : "theirs"}
                                            onClick={(event) => event.stopPropagation()}
                                        />
                                    ))}
                                </div>
                            ) : null}
                            {images.length > 0 ? (
                                <div
                                    className={`mb-1 grid gap-1 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                                >
                                    {images.map((file, index) => (
                                        <button
                                            key={file.id}
                                            type="button"
                                            className="block overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                                            aria-label={`Xem ảnh ${index + 1}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                props.onZoom(message, index);
                                            }}
                                        >
                                            {/* Ảnh ký hạn từ MinIO, kích thước biết trước để không nhảy bố cục. */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={file.url}
                                                alt={`Ảnh ${index + 1}`}
                                                width={file.width || undefined}
                                                height={file.height || undefined}
                                                loading="lazy"
                                                onLoad={props.onMedia}
                                                className="max-h-72 w-full object-cover"
                                                style={{ aspectRatio: file.width && file.height ? `${file.width} / ${file.height}` : undefined }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            {message.sharedPost ? (
                                message.sharedPost.available ? (
                                    <Link
                                        href={`${props.root}/feed/${message.sharedPost.id}`}
                                        className={`mb-1 block rounded-xl border p-2.5 no-underline ${mine ? "border-cream/40 text-cream" : "border-charcoal/15 bg-white text-charcoal"}`}
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <span className="block text-xs font-semibold opacity-80">{message.sharedPost.authorName}</span>
                                        <span className="mt-0.5 line-clamp-4 block text-sm">{message.sharedPost.excerpt}</span>
                                        <span className="mt-1 block text-xs font-semibold underline">Mở bài</span>
                                    </Link>
                                ) : (
                                    <span className="mb-1 block rounded-xl border border-dashed border-current/40 p-2.5 text-sm opacity-80">
                                        Bài viết không còn
                                    </span>
                                )
                            ) : null}
                            {message.body ? (
                                <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
                                    <Linked text={message.body} mine={mine} />
                                </p>
                            ) : null}
                        </>
                    )}
                </div>
                {!deleted ? (
                    <div
                        className={`${showActions ? "flex" : "hidden sm:flex"} items-center gap-0.5 transition-opacity sm:absolute sm:top-1/2 sm:-translate-y-1/2 ${mine ? "sm:right-full sm:mr-1" : "sm:left-full sm:ml-1"} ${showActions ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"}`}
                    >
                        <button
                            type="button"
                            className="inline-flex size-9 items-center justify-center rounded-full text-charcoal/60 hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
                            aria-label="Thả cảm xúc"
                            aria-expanded={menu === "react"}
                            onClick={() => setMenu((current) => (current === "react" ? "none" : "react"))}
                        >
                            <Smile className="size-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="inline-flex size-9 items-center justify-center rounded-full text-charcoal/60 hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
                            aria-label="Trả lời"
                            onClick={() => props.onReply(message)}
                        >
                            <CornerUpLeft className="size-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="inline-flex size-9 items-center justify-center rounded-full text-charcoal/60 hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
                            aria-label="Thêm lựa chọn"
                            aria-expanded={menu === "more"}
                            onClick={() => setMenu((current) => (current === "more" ? "none" : "more"))}
                        >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                        </button>
                        {menu === "react" ? (
                            <div
                                className={`absolute bottom-full z-20 mb-1 flex gap-1 rounded-full border border-charcoal/10 bg-white p-1.5 shadow-md ${mine ? "right-0" : "left-0"}`}
                                role="menu"
                                aria-label="Chọn cảm xúc"
                            >
                                {REACTIONS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        role="menuitem"
                                        className={`inline-flex size-9 items-center justify-center rounded-full text-xl hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green ${message.reactions.some((item) => item.mine && item.emoji === emoji) ? "bg-green/15" : ""}`}
                                        aria-label={emoji}
                                        onClick={() => {
                                            setMenu("none");
                                            props.onReact(message, emoji);
                                        }}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                        {menu === "more" ? (
                            <div
                                className={`absolute bottom-full z-20 mb-1 w-48 rounded-2xl border border-charcoal/10 bg-white p-1.5 shadow-md ${mine ? "right-0" : "left-0"}`}
                                role="menu"
                            >
                                {message.body ? (
                                    <MenuButton
                                        icon={<Copy className="size-4" aria-hidden="true" />}
                                        label="Sao chép"
                                        onClick={() => {
                                            setMenu("none");
                                            void navigator.clipboard?.writeText(message.body);
                                        }}
                                    />
                                ) : null}
                                {mine ? (
                                    <MenuButton
                                        icon={<Undo2 className="size-4" aria-hidden="true" />}
                                        label="Thu hồi"
                                        onClick={() => {
                                            setMenu("none");
                                            props.onUnsend(message);
                                        }}
                                    />
                                ) : (
                                    <MenuButton
                                        icon={<Flag className="size-4" aria-hidden="true" />}
                                        label="Báo cáo"
                                        onClick={() => {
                                            setMenu("none");
                                            props.onReport(message);
                                        }}
                                    />
                                )}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {message.reactions.length > 0 && !deleted ? (
                <div className={`-mt-1.5 flex gap-1 ${mine ? "pr-2" : "pl-2"}`}>
                    {message.reactions.map((reaction) => (
                        <button
                            key={reaction.emoji}
                            type="button"
                            className={`inline-flex min-h-7 items-center gap-1 rounded-full border bg-white px-2 text-xs shadow-sm focus-visible:outline-2 focus-visible:outline-green ${reaction.mine ? "border-green" : "border-charcoal/15"}`}
                            aria-pressed={reaction.mine}
                            aria-label={`${reaction.emoji} ${reaction.count}`}
                            onClick={() => props.onReact(message, reaction.emoji)}
                        >
                            <span aria-hidden="true">{reaction.emoji}</span>
                            {reaction.count > 1 ? <span>{reaction.count}</span> : null}
                        </button>
                    ))}
                </div>
            ) : null}
            {!groupedWithNext ? (
                <span className="mt-0.5 px-1 text-[11px] text-charcoal/50">{clockTime(message.createdAt)}</span>
            ) : null}
        </div>
    );
}

function MenuButton({ icon, label, onClick }: { icon: JSX.Element; label: string; onClick: () => void }): JSX.Element {
    return (
        <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
            onClick={onClick}
        >
            {icon}
            {label}
        </button>
    );
}
