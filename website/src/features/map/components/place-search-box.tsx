"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
    isAbortError,
    mapErrorMessage,
    resolvePlace,
    searchPlaces,
} from "@/features/map/map.service";
import type { SearchFilters } from "@/features/map/map-url";
import type { MapPlace, MapPoint, MapSuggestion } from "@/features/map/map.types";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

type SearchStatus = "idle" | "loading" | "ready" | "error";

interface PlaceSearchBoxProps {
    label: string;
    placeholder: string;
    /** Nhãn hiển thị khi điểm được chọn từ nơi khác (bấm bản đồ, vị trí của tôi…). */
    value: string;
    focus: MapPoint | null;
    onSelect: (place: MapPlace) => void;
    onClear?: () => void;
    /** Báo chuỗi đang gõ (để đồng bộ lên URL). */
    onQueryChange?: (text: string) => void;
    /** Bộ lọc áp dụng cho truy vấn gợi ý (ô tìm chính). */
    filters?: SearchFilters;
    /** Khi `value` đổi từ bên ngoài (vd. URL có `q`), tự chạy tìm kiếm. */
    searchOnValue?: boolean;
    className?: string;
}

export default function PlaceSearchBox({
    label,
    placeholder,
    value,
    focus,
    onSelect,
    onClear,
    onQueryChange,
    filters,
    searchOnValue = false,
    className = "",
}: PlaceSearchBoxProps) {
    const listId = useId();
    const [query, setQuery] = useState(value);
    const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
    const [status, setStatus] = useState<SearchStatus>("idle");
    const [message, setMessage] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [resolving, setResolving] = useState(false);
    const typingRef = useRef(false);
    const focusRef = useRef(focus);
    const filtersRef = useRef<SearchFilters>(filters ?? {});
    const searchRef = useRef<AbortController | null>(null);
    const resolveRef = useRef<AbortController | null>(null);

    useEffect(() => {
        focusRef.current = focus;
        filtersRef.current = filters ?? {};
    });

    useEffect(() => {
        const search = searchOnValue && value.trim().length >= MIN_CHARS;
        typingRef.current = search;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ nhãn từ bên ngoài
        setQuery(value);
        if (search) setOpen(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi giá trị ngoài đổi
    }, [value]);

    useEffect(
        () => () => {
            searchRef.current?.abort();
            resolveRef.current?.abort();
        },
        [],
    );

    useEffect(() => {
        searchRef.current?.abort();
        const text = query.trim();
        if (!typingRef.current) return;
        if (text.length < MIN_CHARS) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- xóa gợi ý khi chuỗi quá ngắn
            setSuggestions([]);
            setStatus("idle");
            return;
        }
        const timer = setTimeout(() => {
            const controller = new AbortController();
            searchRef.current = controller;
            setStatus("loading");
            searchPlaces(text, focusRef.current, filtersRef.current, controller.signal)
                .then((result) => {
                    setSuggestions(result);
                    setStatus("ready");
                    setActive(-1);
                })
                .catch((error: unknown) => {
                    if (isAbortError(error)) return;
                    setSuggestions([]);
                    setStatus("error");
                    setMessage(mapErrorMessage(error, "Không tìm được lúc này, vui lòng thử lại."));
                });
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query]);

    function choose(suggestion: MapSuggestion): void {
        resolveRef.current?.abort();
        const controller = new AbortController();
        resolveRef.current = controller;
        setResolving(true);
        setOpen(false);
        typingRef.current = false;
        setQuery(suggestion.name);
        onQueryChange?.(suggestion.name);
        resolvePlace(suggestion.refId, controller.signal)
            .then((place) => {
                setResolving(false);
                onSelect({ ...place, name: suggestion.name, address: suggestion.address, addressOld: suggestion.addressOld });
            })
            .catch((error: unknown) => {
                if (isAbortError(error)) return;
                setResolving(false);
                setStatus("error");
                setMessage(mapErrorMessage(error, "Không lấy được vị trí, vui lòng chọn lại."));
                setOpen(true);
            });
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, suggestions.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter") {
            const target = suggestions[active] ?? (suggestions.length === 1 ? suggestions[0] : undefined);
            if (target) {
                event.preventDefault();
                choose(target);
            }
        } else if (event.key === "Escape") {
            setOpen(false);
        }
    }

    const showList = open && query.trim().length >= MIN_CHARS && status !== "idle";

    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-charcoal/15 focus-within:ring-2 focus-within:ring-green">
                {resolving || status === "loading" ? (
                    <Loader2 size={18} className="shrink-0 animate-spin text-charcoal/60" aria-hidden />
                ) : (
                    <Search size={18} className="shrink-0 text-charcoal/60" aria-hidden />
                )}
                <input
                    type="text"
                    role="combobox"
                    aria-label={label}
                    aria-expanded={showList}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={120}
                    placeholder={placeholder}
                    value={query}
                    onChange={(event) => {
                        typingRef.current = true;
                        setQuery(event.target.value);
                        onQueryChange?.(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 120)}
                    onKeyDown={onKeyDown}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                {query ? (
                    <button
                        type="button"
                        aria-label="Xóa nội dung tìm kiếm"
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-charcoal/60 hover:bg-charcoal/10"
                        onClick={() => {
                            typingRef.current = false;
                            setQuery("");
                            onQueryChange?.("");
                            setSuggestions([]);
                            setStatus("idle");
                            onClear?.();
                        }}
                    >
                        <X size={14} />
                    </button>
                ) : null}
            </div>
            {showList ? (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={`Gợi ý cho ${label}`}
                    className="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-charcoal/10"
                >
                    {status === "error" ? (
                        <li role="presentation" className="px-4 py-3 text-sm text-red-700">
                            {message}
                        </li>
                    ) : null}
                    {status === "ready" && suggestions.length === 0 ? (
                        <li role="presentation" className="px-4 py-3 text-sm text-charcoal/70">
                            Không tìm thấy địa điểm phù hợp.
                        </li>
                    ) : null}
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={`${suggestion.refId}-${index}`}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            className={`cursor-pointer px-4 py-2 ${index === active ? "bg-green/10" : "hover:bg-charcoal/5"}`}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                choose(suggestion);
                            }}
                        >
                            <p className="m-0 text-sm font-semibold">{suggestion.name}</p>
                            <p className="m-0 text-xs text-charcoal/70">{suggestion.address}</p>
                            {suggestion.addressOld ? (
                                <p className="m-0 text-[11px] text-charcoal/50">Trước đây: {suggestion.addressOld}</p>
                            ) : null}
                            {suggestion.distanceKm !== null ? (
                                <p className="m-0 text-[11px] text-charcoal/50">
                                    {suggestion.distanceKm.toFixed(1).replace(".", ",")} km
                                </p>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
