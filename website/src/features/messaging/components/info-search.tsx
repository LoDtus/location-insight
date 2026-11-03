"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

import { errorText } from "../messaging.actions";
import { searchInConversation } from "../messaging.api";
import { dayLabel, highlightParts } from "../messaging.format";
import type { SearchHit } from "../messaging.types";

const MIN_CHARS = 2;

/** Tìm tin trong hội thoại (không phân biệt dấu và hoa thường); bấm kết quả để cuộn tới tin đó. */
export function InfoSearch({
    conversationId,
    me,
    peerName,
    onJump,
    onBack,
}: {
    conversationId: string;
    me: string;
    peerName: string;
    onJump: (seq: number) => void;
    onBack: () => void;
}): JSX.Element {
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [searched, setSearched] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const generation = useRef(0);
    const text = query.trim();

    useEffect(() => {
        input.current?.focus();
    }, []);

    useEffect(() => {
        generation.current += 1;
        const mine = generation.current;
        if (Array.from(text).length < MIN_CHARS) return;
        const timer = setTimeout(() => {
            setLoading(true);
            searchInConversation(conversationId, text)
                .then((page) => {
                    if (mine !== generation.current) return;
                    setHits(page.items);
                    setCursor(page.nextCursor);
                    setSearched(text);
                    setError("");
                })
                .catch((failure: unknown) => {
                    if (mine === generation.current) setError(errorText(failure, "Không tìm được lúc này."));
                })
                .finally(() => {
                    if (mine === generation.current) setLoading(false);
                });
        }, 300);
        return () => clearTimeout(timer);
    }, [text, conversationId]);

    function more(): void {
        if (!cursor || loading) return;
        const mine = generation.current;
        setLoading(true);
        searchInConversation(conversationId, searched, { cursor })
            .then((page) => {
                if (mine !== generation.current) return;
                setHits((current) => [...current, ...page.items]);
                setCursor(page.nextCursor);
            })
            .catch((failure: unknown) => setError(errorText(failure, "Không tải thêm được.")))
            .finally(() => setLoading(false));
    }

    const ready = Array.from(text).length >= MIN_CHARS;
    const shown = ready ? hits : [];

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-1 border-b border-charcoal/10 px-2 py-1">
                <button
                    type="button"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                    aria-label="Quay lại thông tin hội thoại"
                    onClick={onBack}
                >
                    <ArrowLeft className="size-5" aria-hidden="true" />
                </button>
                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-cream px-3">
                    <Search className="size-4 shrink-0 text-charcoal/60" aria-hidden="true" />
                    <span className="sr-only">Tìm trong cuộc trò chuyện</span>
                    <input
                        ref={input}
                        type="search"
                        value={query}
                        maxLength={100}
                        placeholder="Tìm trong cuộc trò chuyện"
                        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base outline-none placeholder:text-charcoal/45"
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                if (query) setQuery("");
                                else onBack();
                            }
                        }}
                    />
                </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-live="polite">
                {!ready ? (
                    <p className="m-0 px-3 py-6 text-center text-sm text-charcoal/60">
                        Nhập ít nhất {MIN_CHARS} ký tự. Có thể gõ không dấu.
                    </p>
                ) : error && shown.length === 0 ? (
                    <p role="alert" className="m-0 px-3 py-6 text-center text-sm">
                        {error}
                    </p>
                ) : loading && shown.length === 0 ? (
                    <div className="grid gap-2 p-1" aria-hidden="true">
                        {[0, 1, 2].map((index) => (
                            <div key={index} className="h-14 animate-pulse rounded-xl bg-cream" />
                        ))}
                    </div>
                ) : shown.length === 0 && searched === text ? (
                    <p className="m-0 px-3 py-6 text-center text-sm text-charcoal/70">Không thấy tin nào có “{text}”.</p>
                ) : (
                    <ul className="m-0 grid list-none gap-0.5 p-0">
                        {shown.map((hit) => (
                            <li key={hit.messageId} className="list-none">
                                <button
                                    type="button"
                                    className="block w-full rounded-xl px-3 py-2 text-left hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                                    onClick={() => onJump(hit.seq)}
                                >
                                    <span className="flex items-baseline justify-between gap-2 text-xs text-charcoal/60">
                                        <span className="truncate font-semibold">{hit.senderId === me ? "Bạn" : peerName}</span>
                                        <span className="shrink-0">{dayLabel(hit.createdAt)}</span>
                                    </span>
                                    <span className="mt-0.5 block text-sm [overflow-wrap:anywhere]">
                                        {highlightParts(hit.snippet, searched).map((part, index) =>
                                            part.match ? (
                                                <mark key={index} className="rounded-sm bg-gold/60 px-0.5 text-inherit">
                                                    {part.text}
                                                </mark>
                                            ) : (
                                                <span key={index}>{part.text}</span>
                                            ),
                                        )}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {ready && cursor ? (
                    <div className="py-3 text-center">
                        <button
                            type="button"
                            disabled={loading}
                            className="min-h-11 rounded-full border border-charcoal/25 px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-green disabled:opacity-60"
                            onClick={more}
                        >
                            {loading ? "Đang tải…" : "Tải thêm kết quả"}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
