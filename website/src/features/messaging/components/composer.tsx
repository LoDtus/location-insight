"use client";

import { ImagePlus, Paperclip, SendHorizontal, Smile, X } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type JSX } from "react";

import { notifyTyping, sendMessage, stopTyping } from "../messaging.actions";
import { FILE_ACCEPT, validateFile, validateImage } from "../messaging.api";
import { ATTACHMENTS_MAX, BODY_MAX, DRAFT_KEY, EMOJI_PICKER } from "../messaging.constants";
import { formatBytes } from "../messaging.format";
import { FileTypeIcon } from "./file-card";
import type { Message } from "../messaging.types";

function readDraft(id: string): string {
    try {
        return window.sessionStorage.getItem(DRAFT_KEY(id)) ?? "";
    } catch {
        return "";
    }
}

function writeDraft(id: string, value: string): void {
    try {
        if (value) window.sessionStorage.setItem(DRAFT_KEY(id), value);
        else window.sessionStorage.removeItem(DRAFT_KEY(id));
    } catch {
        /* sessionStorage có thể bị chặn */
    }
}

export function Composer({
    conversationId,
    replyTo,
    replyName,
    onClearReply,
    onSent,
}: {
    conversationId: string;
    replyTo: Message | null;
    replyName: string;
    onClearReply: () => void;
    onSent: () => void;
}): JSX.Element {
    const [text, setText] = useState(() => (typeof window === "undefined" ? "" : readDraft(conversationId)));
    const [items, setItems] = useState<Array<{ file: File; url: string }>>([]);
    const files = items.map((item) => item.file);
    const previews = items.map((item) => item.url);
    const [documents, setDocuments] = useState<File[]>([]);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [notice, setNotice] = useState("");
    const [dragging, setDragging] = useState(false);
    const area = useRef<HTMLTextAreaElement>(null);
    const picker = useRef<HTMLDivElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const documentInput = useRef<HTMLInputElement>(null);
    const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const itemsRef = useRef(items);
    useEffect(() => {
        itemsRef.current = items;
    }, [items]);
    useEffect(() => {
        return () => {
            if (stopTimer.current) clearTimeout(stopTimer.current);
            stopTyping(conversationId);
            itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
        };
    }, [conversationId]);

    useEffect(() => {
        const element = area.current;
        if (!element) return;
        element.style.height = "auto";
        element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
    }, [text]);

    useEffect(() => {
        if (replyTo) area.current?.focus();
    }, [replyTo]);

    useEffect(() => {
        if (!emojiOpen) return;
        function away(event: MouseEvent): void {
            if (event.target instanceof Node && !picker.current?.contains(event.target)) setEmojiOpen(false);
        }
        window.addEventListener("mousedown", away);
        return () => window.removeEventListener("mousedown", away);
    }, [emojiOpen]);

    function addFiles(incoming: File[]): void {
        const images = incoming.filter((file) => file.type.startsWith("image/"));
        const others = incoming.filter((file) => !file.type.startsWith("image/"));
        if (images.length) {
            const next = [...items];
            for (const file of images) {
                const problem = validateImage(file);
                if (problem) {
                    setNotice(problem);
                    continue;
                }
                if (next.length >= ATTACHMENTS_MAX) {
                    setNotice(`Tối đa ${ATTACHMENTS_MAX} ảnh mỗi tin.`);
                    break;
                }
                next.push({ file, url: URL.createObjectURL(file) });
            }
            setItems(next);
        }
        if (others.length) {
            const next = [...documents];
            for (const file of others) {
                const problem = validateFile(file);
                if (problem) {
                    setNotice(`${file.name}: ${problem}`);
                    continue;
                }
                if (next.length >= ATTACHMENTS_MAX) {
                    setNotice(`Tối đa ${ATTACHMENTS_MAX} tệp mỗi tin.`);
                    break;
                }
                next.push(file);
            }
            setDocuments(next);
        }
    }

    function change(value: string): void {
        setText(value);
        writeDraft(conversationId, value);
        if (value.trim()) {
            notifyTyping(conversationId);
            if (stopTimer.current) clearTimeout(stopTimer.current);
            stopTimer.current = setTimeout(() => stopTyping(conversationId), 3000);
        } else {
            stopTyping(conversationId);
        }
    }

    const body = text.trim();
    const tooLong = text.length > BODY_MAX;
    const canSubmit = (body.length > 0 || files.length > 0 || documents.length > 0) && !tooLong;

    function submit(): void {
        if (!canSubmit) return;
        // Ảnh và tệp đi thành hai tin riêng; chữ và trả lời đi cùng tin đầu tiên.
        if (files.length) {
            sendMessage(conversationId, { kind: "image", body, replyToSeq: replyTo?.seq ?? null, files });
        }
        if (documents.length) {
            sendMessage(conversationId, {
                kind: "file",
                body: files.length ? "" : body,
                replyToSeq: files.length ? null : (replyTo?.seq ?? null),
                files: documents,
            });
        }
        if (!files.length && !documents.length) {
            sendMessage(conversationId, { kind: "text", body, replyToSeq: replyTo?.seq ?? null });
        }
        setDocuments([]);
        setText("");
        // ảnh xem trước được thu hồi khi tin gửi xong (sendMessage tự tạo URL riêng)
        items.forEach((item) => URL.revokeObjectURL(item.url));
        setItems([]);
        setNotice("");
        writeDraft(conversationId, "");
        stopTyping(conversationId);
        onClearReply();
        onSent();
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
        if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
        if (window.matchMedia("(pointer: coarse)").matches) return;
        event.preventDefault();
        submit();
    }

    function onPaste(event: ClipboardEvent<HTMLTextAreaElement>): void {
        const pasted = [...event.clipboardData.files];
        if (pasted.length > 0) {
            event.preventDefault();
            addFiles(pasted);
        }
    }

    function onDrop(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        setDragging(false);
        addFiles([...event.dataTransfer.files]);
    }

    return (
        <div
            className={`border-t border-charcoal/10 bg-white px-3 pt-2 pb-3 ${dragging ? "outline-2 -outline-offset-4 outline-dashed outline-green" : ""}`}
            onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
        >
            {replyTo ? (
                <div className="mb-2 flex items-start gap-2 rounded-2xl bg-cream px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                        <p className="m-0 text-xs font-semibold text-charcoal/70">Đang trả lời {replyName}</p>
                        <p className="m-0 truncate">{replyTo.body || (replyTo.attachments[0]?.kind === "file" ? "Tệp" : replyTo.attachments.length ? "Ảnh" : "Bài viết")}</p>
                    </div>
                    <button
                        type="button"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
                        aria-label="Bỏ trả lời"
                        onClick={onClearReply}
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>
            ) : null}
            {previews.length > 0 ? (
                <ul className="mb-2 flex gap-2 overflow-x-auto p-0" aria-label="Ảnh đính kèm">
                    {previews.map((url, index) => (
                        <li key={url} className="relative list-none">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Ảnh đính kèm ${index + 1}`} className="size-20 rounded-xl object-cover" />
                            <button
                                type="button"
                                className="absolute -top-2 -right-2 inline-flex size-7 items-center justify-center rounded-full bg-charcoal text-cream focus-visible:outline-2 focus-visible:outline-green"
                                aria-label={`Bỏ ảnh ${index + 1}`}
                                onClick={() => {
                                    URL.revokeObjectURL(items[index]?.url ?? "");
                                    setItems((current) => current.filter((_, i) => i !== index));
                                }}
                            >
                                <X className="size-3.5" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {documents.length > 0 ? (
                <ul className="mb-2 grid gap-1.5 p-0" aria-label="Tệp đính kèm">
                    {documents.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex list-none items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
                            <FileTypeIcon fileName={file.name} className="size-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate font-semibold">{file.name}</span>
                            <span className="shrink-0 text-xs text-charcoal/60">{formatBytes(file.size)}</span>
                            <button
                                type="button"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
                                aria-label={`Bỏ tệp ${file.name}`}
                                onClick={() => setDocuments((current) => current.filter((_, i) => i !== index))}
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {notice ? (
                <p role="alert" className="m-0 mb-2 text-sm text-red-700">
                    {notice}
                </p>
            ) : null}
            <div className="relative flex items-end gap-2">
                <button
                    type="button"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-cream hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
                    aria-label="Đính kèm ảnh"
                    onClick={() => fileInput.current?.click()}
                >
                    <ImagePlus className="size-5" aria-hidden="true" />
                </button>
                <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        addFiles([...(event.target.files ?? [])]);
                        event.target.value = "";
                    }}
                />
                <button
                    type="button"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-cream hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
                    aria-label="Đính kèm tệp"
                    onClick={() => documentInput.current?.click()}
                >
                    <Paperclip className="size-5" aria-hidden="true" />
                </button>
                <input
                    ref={documentInput}
                    type="file"
                    accept={FILE_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        addFiles([...(event.target.files ?? [])]);
                        event.target.value = "";
                    }}
                />
                <div className="flex min-h-11 min-w-0 flex-1 items-end gap-1 rounded-3xl bg-cream px-2">
                    <div ref={picker} className="relative">
                        <button
                            type="button"
                            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-green"
                            aria-label="Chèn biểu tượng cảm xúc"
                            aria-expanded={emojiOpen}
                            onClick={() => setEmojiOpen((current) => !current)}
                        >
                            <Smile className="size-5" aria-hidden="true" />
                        </button>
                        {emojiOpen ? (
                            <div
                                className="absolute bottom-12 left-0 z-20 grid w-64 grid-cols-8 gap-0.5 rounded-2xl border border-charcoal/10 bg-white p-2 shadow-md"
                                role="menu"
                                aria-label="Biểu tượng cảm xúc"
                            >
                                {EMOJI_PICKER.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        role="menuitem"
                                        className="inline-flex size-7 items-center justify-center rounded-md text-lg hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                                        aria-label={emoji}
                                        onClick={() => {
                                            change(`${text}${emoji}`);
                                            area.current?.focus();
                                        }}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    <label className="min-w-0 flex-1">
                        <span className="sr-only">Nhập tin nhắn</span>
                        <textarea
                            ref={area}
                            rows={1}
                            value={text}
                            placeholder="Nhắn tin…"
                            className="block max-h-36 min-h-11 w-full resize-none border-0 bg-transparent py-3 text-[15px] leading-snug outline-none placeholder:text-charcoal/45"
                            onChange={(event) => change(event.target.value)}
                            onKeyDown={onKeyDown}
                            onPaste={onPaste}
                        />
                    </label>
                </div>
                <button
                    type="button"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-green text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:bg-charcoal/20 disabled:text-charcoal/50"
                    aria-label="Gửi"
                    disabled={!canSubmit}
                    onClick={submit}
                >
                    <SendHorizontal className="size-5" aria-hidden="true" />
                </button>
            </div>
            {text.length >= BODY_MAX - 200 ? (
                <p className={`m-0 mt-1 text-right text-xs ${tooLong ? "font-semibold text-red-700" : "text-charcoal/60"}`} aria-live="polite">
                    {text.length.toLocaleString("vi-VN")}/{BODY_MAX.toLocaleString("vi-VN")}
                </p>
            ) : null}
        </div>
    );
}
