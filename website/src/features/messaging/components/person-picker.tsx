"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type JSX } from "react";

import { errorText } from "../messaging.actions";
import { searchRecipients } from "../messaging.api";
import { useMessagingState } from "../messaging.store";
import type { Person } from "../messaging.types";
import { PersonAvatar } from "./person-avatar";

/** Chọn một người: gợi ý từ các hội thoại gần đây, tìm theo tên khi gõ từ 2 ký tự. */
export function PersonPicker({
    onPick,
    disabled = false,
    emptyHint = "Gõ ít nhất 2 ký tự để tìm người.",
}: {
    onPick: (person: Person) => void;
    disabled?: boolean;
    emptyHint?: string;
}): JSX.Element {
    const [query, setQuery] = useState("");
    const [found, setFound] = useState<{ query: string; items: Person[]; error: string } | null>(null);
    const conversations = useMessagingState((state) => state.conversations);

    const recent = useMemo(
        () =>
            Object.values(conversations)
                .filter((item) => item.state === "active" && item.lastSeq > 0)
                .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))
                .slice(0, 6)
                .map((item) => item.peer),
        [conversations],
    );

    const text = query.trim();
    useEffect(() => {
        if (text.length < 2) return;
        let active = true;
        const timer = setTimeout(() => {
            searchRecipients(text)
                .then((page) => {
                    if (active) setFound({ query: text, items: page.items, error: "" });
                })
                .catch((failure: unknown) => {
                    if (active) setFound({ query: text, items: [], error: errorText(failure, "Không tìm được lúc này.") });
                });
        }, 250);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [text]);

    const searching = text.length >= 2;
    const current = searching && found?.query === text ? found : null;
    const loading = searching && !current;
    const error = current?.error ?? "";
    const list = searching ? (current?.items ?? []) : recent;

    return (
        <div>
            <label className="flex min-h-11 items-center gap-2 rounded-full bg-cream px-4">
                <Search className="size-4 shrink-0 text-charcoal/60" aria-hidden="true" />
                <span className="sr-only">Tìm người</span>
                <input
                    type="search"
                    value={query}
                    maxLength={50}
                    placeholder="Tìm theo tên"
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base outline-none placeholder:text-charcoal/45"
                />
            </label>
            {error ? (
                <p role="alert" className="mt-2 mb-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
            <p className="mt-3 mb-1 text-xs font-semibold text-charcoal/60">{searching ? "Kết quả" : recent.length ? "Gần đây" : ""}</p>
            <ul className="m-0 grid gap-0.5 p-0" aria-busy={loading}>
                {list.map((person) => (
                    <li key={person.id} className="list-none">
                        <button
                            type="button"
                            disabled={disabled}
                            className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-cream focus-visible:outline-2 focus-visible:outline-green disabled:opacity-60"
                            onClick={() => onPick(person)}
                        >
                            <PersonAvatar name={person.displayName} url={person.avatarUrl} size={40} />
                            <span className="truncate font-semibold">{person.displayName}</span>
                        </button>
                    </li>
                ))}
            </ul>
            {!loading && searching && list.length === 0 && !error ? (
                <p className="m-0 mt-2 text-sm text-charcoal/70">Không thấy ai tên “{text}”.</p>
            ) : null}
            {!searching && recent.length === 0 ? <p className="m-0 mt-2 text-sm text-charcoal/70">{emptyHint}</p> : null}
        </div>
    );
}
