"use client";

import { Clock, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type JSX } from "react";

import { SEARCH_RADIUS, clampSearchRadius, formatRadius } from "@/features/map/map.geo";
import { exactSuggestion } from "@/features/map/map-search-intent";
import {
    pushSearchHistory,
    readSearchHistory,
    removeSearchHistory,
    type SearchHistoryEntry,
} from "@/features/map/map-search-history";
import { isAbortError, mapErrorMessage, resolvePlace, searchPlaces } from "@/features/map/map.service";
import type { SearchFilters } from "@/features/map/map-url";
import type { MapPlace, MapPoint, MapSuggestion } from "@/features/map/map.types";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

type Status = "idle" | "loading" | "ready" | "error";

interface MapSearchBarProps {
    /** Chuỗi ban đầu / từ URL. */
    value: string;
    /** Tâm tìm kiếm: điểm đang ghim, không có thì tâm bản đồ. */
    center: MapPoint;
    /** Tâm là điểm đang ghim (khác tâm bản đồ). */
    centerIsPin: boolean;
    radiusM: number;
    /** Lọc theo loại kết quả / nhóm địa điểm (bán kính lấy từ `radiusM`). */
    filters: SearchFilters;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Tăng giá trị này để đưa con trỏ vào ô tìm kiếm (mở popover). */
    focusSignal: number;
    onQueryChange: (text: string) => void;
    onRadius: (radiusM: number) => void;
    /** Chọn một địa điểm cụ thể. */
    onSelectPlace: (place: MapPlace) => void;
    /** Tìm theo loại hình: ghim mọi kết quả liên quan trong phạm vi. */
    onSearchAll: (text: string) => void;
    /** Xóa nội dung ô tìm: gỡ các ghim kết quả. */
    onClear: () => void;
}

/**
 * Ô tìm kiếm của trang bản đồ kèm "Search Popover": lịch sử tìm kiếm gần nhất khi chưa gõ, gợi ý khi đang gõ,
 * và thanh trượt + ô số chỉnh phạm vi tìm kiếm quanh điểm ghim/tâm bản đồ.
 */
export default function MapSearchBar({
    value,
    center,
    centerIsPin,
    radiusM,
    filters,
    open,
    onOpenChange,
    focusSignal,
    onQueryChange,
    onRadius,
    onSelectPlace,
    onSearchAll,
    onClear,
}: MapSearchBarProps): JSX.Element {
    const listId = useId();
    const radiusId = useId();
    const [query, setQuery] = useState(value);
    const [typing, setTyping] = useState(false);
    const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
    const [status, setStatus] = useState<Status>("idle");
    const [message, setMessage] = useState("");
    const [active, setActive] = useState(-1);
    const [resolving, setResolving] = useState(false);
    const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
    const [radiusText, setRadiusText] = useState(String(radiusM / 1000));
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchRef = useRef<AbortController | null>(null);
    const resolveRef = useRef<AbortController | null>(null);
    const latest = useRef({ center, filters, radiusM });

    useEffect(() => {
        latest.current = { center, filters, radiusM };
    });

    useEffect(() => {
        if (focusSignal > 0) inputRef.current?.focus();
    }, [focusSignal]);

    // Giá trị ngoài đổi (URL): hiện lại chuỗi, không tự tìm.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ chuỗi từ bên ngoài
        setQuery(value);
    }, [value]);

    // Bán kính đổi từ thanh trượt: cập nhật ô số.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ ô số với thanh trượt
        setRadiusText(String(radiusM / 1000).replace(".", ","));
    }, [radiusM]);

    // Mở popover: đọc lại lịch sử (có thể đã đổi ở tab khác).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc storage khi mở
        if (open) setHistory(readSearchHistory());
    }, [open]);

    useEffect(
        () => () => {
            searchRef.current?.abort();
            resolveRef.current?.abort();
        },
        [],
    );

    const text = query.trim();
    const searchKey = `${radiusM}|${filters.cats ?? ""}|${filters.scope ?? ""}|${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
    useEffect(() => {
        searchRef.current?.abort();
        if (!typing) return;
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
            const { center: focus, filters: current, radiusM: radius } = latest.current;
            searchPlaces(text, focus, { ...current, radius }, controller.signal)
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
    }, [text, typing, searchKey]);

    function close(): void {
        onOpenChange(false);
        setTyping(false);
    }

    function choose(suggestion: MapSuggestion): void {
        resolveRef.current?.abort();
        const controller = new AbortController();
        resolveRef.current = controller;
        setResolving(true);
        setQuery(suggestion.name);
        onQueryChange(suggestion.name);
        close();
        resolvePlace(suggestion.refId, controller.signal)
            .then((place) => {
                setResolving(false);
                const chosen = { ...place, name: suggestion.name, address: suggestion.address, addressOld: suggestion.addressOld };
                setHistory(pushSearchHistory({ type: "place", text: suggestion.name, lat: chosen.lat, lng: chosen.lng, address: chosen.address || chosen.display, at: 0 }));
                onSelectPlace(chosen);
            })
            .catch((error: unknown) => {
                if (isAbortError(error)) return;
                setResolving(false);
                setStatus("error");
                setMessage(mapErrorMessage(error, "Không lấy được vị trí, vui lòng chọn lại."));
                onOpenChange(true);
            });
    }

    function searchAll(value: string): void {
        searchRef.current?.abort();
        setHistory(pushSearchHistory({ type: "query", text: value, at: 0 }));
        close();
        inputRef.current?.blur();
        onSearchAll(value);
    }

    function submit(): void {
        if (active >= 0 && suggestions[active]) {
            choose(suggestions[active]);
            return;
        }
        if (text.length < MIN_CHARS) return;
        const exact = status === "ready" ? exactSuggestion(text, suggestions) : null;
        if (exact) choose(exact);
        else searchAll(text);
    }

    function openHistory(entry: SearchHistoryEntry): void {
        setQuery(entry.text);
        onQueryChange(entry.text);
        if (entry.type === "query") {
            searchAll(entry.text);
            return;
        }
        setHistory(pushSearchHistory({ ...entry, at: 0 }));
        close();
        inputRef.current?.blur();
        onSelectPlace({ lat: entry.lat, lng: entry.lng, name: entry.text, address: entry.address, addressOld: null, display: entry.address || entry.text });
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpenChange(true);
            setActive((index) => Math.min(index + 1, suggestions.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, -1));
        } else if (event.key === "Enter") {
            event.preventDefault();
            submit();
        } else if (event.key === "Escape") {
            close();
        }
    }

    function commitRadiusText(raw: string): void {
        const km = Number(raw.replace(",", "."));
        if (!Number.isFinite(km) || km <= 0) return;
        onRadius(clampSearchRadius(km * 1000));
    }

    const showSuggestions = typing && text.length >= MIN_CHARS && status !== "idle";
    const showHistory = text.length === 0;

    return (
        <div
            ref={wrapperRef}
            className="relative min-w-0 flex-1"
            onFocus={() => onOpenChange(true)}
            onBlur={(event) => {
                if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) close();
            }}
        >
            <div
                className={`flex items-center gap-2 bg-white px-4 py-2 shadow-sm ring-1 ring-charcoal/15 focus-within:ring-2 focus-within:ring-green ${open ? "rounded-t-2xl rounded-b-none" : "rounded-full"}`}
            >
                {resolving || status === "loading" ? (
                    <Loader2 size={18} className="shrink-0 animate-spin text-charcoal/60" aria-hidden />
                ) : (
                    <Search size={18} className="shrink-0 text-charcoal/60" aria-hidden />
                )}
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-label="Tìm kiếm địa điểm"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={120}
                    placeholder={`Tìm trong ${formatRadius(radiusM)} quanh ${centerIsPin ? "điểm đã ghim" : "tâm bản đồ"}`}
                    value={query}
                    onChange={(event) => {
                        setTyping(true);
                        setQuery(event.target.value);
                        onQueryChange(event.target.value);
                        onOpenChange(true);
                    }}
                    onKeyDown={onKeyDown}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                {query ? (
                    <button
                        type="button"
                        aria-label="Xóa nội dung tìm kiếm"
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-charcoal/60 hover:bg-charcoal/10"
                        onClick={() => {
                            setTyping(false);
                            setQuery("");
                            onQueryChange("");
                            setSuggestions([]);
                            setStatus("idle");
                            onClear();
                            inputRef.current?.focus();
                        }}
                    >
                        <X size={14} />
                    </button>
                ) : null}
            </div>

            {open ? (
                <div
                    tabIndex={-1}
                    className="absolute top-full right-0 left-0 z-30 max-h-[70vh] overflow-y-auto rounded-b-2xl bg-white pb-1.5 shadow-lg ring-1 ring-charcoal/15 outline-none [scrollbar-width:thin]"
                >
                    <div className="border-t border-charcoal/10 px-4 pt-2.5 pb-3">
                        <div className="flex items-baseline justify-between gap-2">
                            <label htmlFor={radiusId} className="text-xs font-semibold text-charcoal/80">
                                Phạm vi tìm kiếm
                            </label>
                            <span className="truncate text-[11px] text-charcoal/55">
                                quanh {centerIsPin ? "điểm đã ghim" : "tâm bản đồ"}
                            </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                            <input
                                id={radiusId}
                                type="range"
                                min={SEARCH_RADIUS.min}
                                max={SEARCH_RADIUS.max}
                                step={SEARCH_RADIUS.step}
                                value={radiusM}
                                onChange={(event) => onRadius(Number(event.target.value))}
                                aria-valuetext={formatRadius(radiusM)}
                                className="h-2 min-w-0 flex-1 accent-green"
                            />
                            <span className="flex shrink-0 items-center rounded-lg ring-1 ring-charcoal/15 focus-within:ring-2 focus-within:ring-green">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    aria-label="Bán kính (km)"
                                    value={radiusText}
                                    onChange={(event) => {
                                        setRadiusText(event.target.value);
                                        commitRadiusText(event.target.value);
                                    }}
                                    onBlur={() => setRadiusText(String(radiusM / 1000).replace(".", ","))}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            submit();
                                        }
                                    }}
                                    className="w-12 bg-transparent py-1 pl-2 text-right text-sm font-semibold tabular-nums outline-none"
                                />
                                <span className="pr-2 pl-1 text-xs text-charcoal/60">km</span>
                            </span>
                        </div>
                    </div>

                    <div className="border-t border-charcoal/10 pt-1.5">
                        {showHistory ? (
                            history.length > 0 ? (
                                <>
                                    <p className="m-0 px-4 pt-1 pb-1 text-xs font-semibold text-charcoal/60">Tìm kiếm gần đây</p>
                                    <ul className="m-0 list-none p-0">
                                        {history.map((entry) => (
                                            <li key={`${entry.type}-${entry.text}`} className="group flex items-center hover:bg-charcoal/5 focus-within:bg-charcoal/5">
                                                <button
                                                    type="button"
                                                    onClick={() => openHistory(entry)}
                                                    className="flex min-w-0 flex-1 items-center gap-3 bg-transparent px-4 py-2 text-left focus-visible:outline-none"
                                                >
                                                    {entry.type === "place" ? (
                                                        <MapPin size={16} className="shrink-0 text-charcoal/50" aria-hidden />
                                                    ) : (
                                                        <Clock size={16} className="shrink-0 text-charcoal/50" aria-hidden />
                                                    )}
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm">{entry.text}</span>
                                                        {entry.type === "place" && entry.address ? (
                                                            <span className="block truncate text-xs text-charcoal/55">{entry.address}</span>
                                                        ) : null}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Xóa "${entry.text}" khỏi lịch sử`}
                                                    onClick={() => setHistory(removeSearchHistory(entry))}
                                                    className="mr-2 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-transparent text-charcoal/45 opacity-0 group-hover:opacity-100 hover:bg-charcoal/10 hover:text-charcoal focus-visible:opacity-100"
                                                >
                                                    <X size={14} aria-hidden />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <p className="m-0 px-4 py-2 text-xs text-charcoal/55">
                                    Chưa có lịch sử tìm kiếm. Gõ tên địa điểm, hoặc loại hình như “ngân hàng” rồi nhấn Enter để ghim mọi kết quả trong phạm vi.
                                </p>
                            )
                        ) : null}

                        {showSuggestions ? (
                            <ul id={listId} role="listbox" aria-label="Gợi ý tìm kiếm" className="m-0 list-none p-0">
                                {status === "error" ? (
                                    <li role="presentation" className="px-4 py-2.5 text-sm text-red-700">
                                        {message}
                                    </li>
                                ) : null}
                                {status === "ready" && suggestions.length === 0 ? (
                                    <li role="presentation" className="px-4 py-2.5 text-sm text-charcoal/70">
                                        Không có địa điểm phù hợp trong {formatRadius(radiusM)}. Thử tăng phạm vi tìm kiếm.
                                    </li>
                                ) : null}
                                {suggestions.map((suggestion, index) => (
                                    <li
                                        key={`${suggestion.refId}-${index}`}
                                        id={`${listId}-${index}`}
                                        role="option"
                                        aria-selected={index === active}
                                        className={`flex cursor-pointer items-start gap-3 px-4 py-2 ${index === active ? "bg-green/10" : "hover:bg-charcoal/5"}`}
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            choose(suggestion);
                                        }}
                                    >
                                        <MapPin size={16} className="mt-0.5 shrink-0 text-charcoal/50" aria-hidden />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold">{suggestion.name}</span>
                                            <span className="block text-xs text-charcoal/65">{suggestion.address}</span>
                                        </span>
                                        {suggestion.distanceKm !== null ? (
                                            <span className="shrink-0 text-[11px] text-charcoal/50 tabular-nums">
                                                {suggestion.distanceKm.toFixed(1).replace(".", ",")} km
                                            </span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        {text.length >= MIN_CHARS ? (
                            <button
                                type="button"
                                onClick={() => searchAll(text)}
                                className="flex w-full items-center gap-3 bg-transparent px-4 py-2 text-left text-sm text-green hover:bg-green/5 focus-visible:bg-green/5 focus-visible:outline-none"
                            >
                                <Search size={16} className="shrink-0" aria-hidden />
                                <span className="min-w-0 flex-1 truncate">
                                    Ghim mọi kết quả “<b>{text}</b>” trong {formatRadius(radiusM)}
                                </span>
                                <kbd className="shrink-0 rounded border border-charcoal/15 px-1 text-[10px] text-charcoal/55">Enter</kbd>
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
