"use client";

import {
    Bath,
    Bed,
    Heart,
    LayoutGrid,
    List,
    Ruler,
    SlidersHorizontal,
    Sofa,
    X,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { ShellRoot } from "@/features/app/shell";
import ListingGallery from "@/features/landing-page/components/listing-gallery";
import Pagination from "@/shared/components/ui/pagination";
import {
    DISTRICTS,
    LISTING_KINDS,
    LISTINGS,
    RENT_PRICE_RANGES,
    SALE_PRICE_RANGES,
    SORT_KEYS,
    formatArea,
    formatListingDate,
    formatListingPrice,
    listingPath,
    type Listing,
    type ListingPurpose,
    type SortKey,
} from "@/features/landing-page/data/listings";
import { parseDrafts, readDraftsRaw } from "@/features/properties/property-drafts";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import type { LocaleMessages } from "@/shared/types/locale.types";
import { getLocaleValue } from "@/shared/utils/locale.utils";

/** Số dòng mỗi trang ở dạng lưới; số cột đo theo bề rộng khung kết quả (xem columnsForWidth). */
const GRID_ROWS = 4;
/** Dạng danh sách: mỗi tin một dòng. */
const LIST_PAGE_SIZE = 8;
const INTEREST_KEY = "property-interest";

/**
 * Số cột theo bề rộng khung kết quả (không phải màn hình), nên cạnh thanh lọc hay thanh bên của ứng dụng vẫn đủ rộng.
 * Màn tiêu chuẩn (1920 px) cho 5 tin trên một dòng.
 */
function columnsForWidth(width: number): number {
    if (width >= 1100) return 5;
    if (width >= 880) return 4;
    if (width >= 640) return 3;
    if (width >= 420) return 2;
    return 1;
}

const interestListeners = new Set<() => void>();

function subscribeInterest(listener: () => void): () => void {
    interestListeners.add(listener);

    return () => interestListeners.delete(listener);
}

/** Chuỗi thô trong sessionStorage ("" khi chưa có hoặc bị chặn); snapshot ổn định cho useSyncExternalStore. */
function readInterestRaw(): string {
    try {
        return sessionStorage.getItem(INTEREST_KEY) ?? "";
    } catch {
        return "";
    }
}

function parseInterest(raw: string): Set<string> {
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) {
            return new Set();
        }

        return new Set(parsed.filter((item): item is string => typeof item === "string"));
    } catch {
        return new Set();
    }
}

function subscribeNothing(): () => void {
    return () => undefined;
}

const FIELD_CLASS =
    "box-border min-h-11 w-full rounded-full border border-charcoal/20 bg-white px-4 text-sm text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

function fold(value: string): string {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function readPurpose(value: string | null): "" | ListingPurpose {
    if (value === "ban" || value === "thue") {
        return value;
    }

    return "";
}

function readPage(value: string | null): number {
    const page = Number(value);

    if (!Number.isInteger(page) || page < 1) {
        return 1;
    }

    return page;
}

function readSort(value: string | null): SortKey {
    if (value !== null && (SORT_KEYS as readonly string[]).includes(value)) {
        return value as SortKey;
    }

    return "updated";
}

function readCsv(value: string | null, allowed: readonly string[]): string[] {
    if (!value) {
        return [];
    }

    return value.split(",").filter((item) => allowed.includes(item));
}

function toggleCsv(current: string[], value: string): string | null {
    const next = new Set(current);

    if (next.has(value)) {
        next.delete(value);
    } else {
        next.add(value);
    }

    return next.size > 0 ? [...next].join(",") : null;
}

function matchesPrice(
    listing: Listing,
    priceId: string,
    purpose: "" | ListingPurpose,
): boolean {
    if (!priceId) {
        return true;
    }

    const ranges = purpose === "thue" ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
    const range = ranges.find((item) => item.id === priceId);

    if (!range) {
        return true;
    }

    if (listing.purpose !== (purpose === "thue" ? "thue" : "ban")) {
        return false;
    }

    return listing.priceVnd >= range.min && listing.priceVnd < range.max;
}

function compareListings(left: Listing, right: Listing, sort: SortKey): number {
    if (sort === "price-asc") {
        return left.priceVnd - right.priceVnd;
    }

    if (sort === "price-desc") {
        return right.priceVnd - left.priceVnd;
    }

    if (sort === "area") {
        return right.areaM2 - left.areaM2;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
}

function ListingCard({
    listing,
    messages,
    locale,
    view,
    eager,
    href,
    interest,
}: {
    listing: Listing;
    messages: LocaleMessages;
    locale: string;
    view: "grid" | "list";
    eager: boolean;
    href: string;
    /** Chỉ trong ứng dụng: nút quan tâm (lưu trong phiên trình duyệt). */
    interest?: { on: boolean; label: string; toggle: () => void };
}) {
    const specs: { icon: LucideIcon; text: string }[] = [
        { icon: Ruler, text: formatArea(listing.areaM2, locale) },
    ];

    if (listing.beds > 0) {
        specs.push({
            icon: Bed,
            text: `${listing.beds} ${getLocaleValue(messages, ["catalog", "specBeds"])}`,
        });
    }

    if (listing.living > 0) {
        specs.push({
            icon: Sofa,
            text: `${listing.living} ${getLocaleValue(messages, ["catalog", "specLiving"])}`,
        });
    }

    if (listing.baths > 0) {
        specs.push({
            icon: Bath,
            text: `${listing.baths} ${getLocaleValue(messages, ["catalog", "specBaths"])}`,
        });
    }

    return (
        <article className="min-w-0 overflow-hidden rounded-2xl border border-charcoal/15 bg-white">
            <div
                className={
                    view === "list"
                        ? "grid sm:grid-cols-[18rem_minmax(0,1fr)]"
                        : undefined
                }
            >
                <div className="relative">
                    <Link
                        href={href}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="absolute inset-0 z-0"
                    />
                    <div className="pointer-events-none relative z-10">
                        <ListingGallery
                            images={listing.images}
                            label={listing.title}
                            previousLabel={getLocaleValue(messages, ["catalog", "previous"])}
                            nextLabel={getLocaleValue(messages, ["catalog", "next"])}
                            eager={eager}
                        />
                    </div>
                    {interest ? (
                        <button
                            type="button"
                            aria-pressed={interest.on}
                            aria-label={interest.label}
                            title={interest.label}
                            className={`pointer-events-auto absolute top-3 right-3 z-20 inline-flex size-11 items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${interest.on ? "border-green bg-green text-cream" : "border-charcoal/15 bg-white text-charcoal"}`}
                            onClick={interest.toggle}
                        >
                            <Heart
                                size={18}
                                aria-hidden="true"
                                className={interest.on ? "fill-current" : ""}
                            />
                        </button>
                    ) : null}
                </div>
                <Link
                    href={href}
                    className="flex min-w-0 flex-col gap-2 p-4 text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="m-0 text-xl font-semibold text-green tabular-nums">
                            {formatListingPrice(listing, locale)}
                        </p>
                        <p className="m-0 shrink-0 text-sm text-charcoal/70">
                            {getLocaleValue(messages, ["catalog", "kinds", listing.kind])}
                            {" · "}
                            {getLocaleValue(messages, [
                                "catalog",
                                listing.purpose === "ban" ? "purposeBan" : "purposeThue",
                            ])}
                        </p>
                    </div>
                    <h2 className="m-0 text-base leading-snug font-semibold">
                        {listing.title}
                    </h2>
                    <p className="m-0 text-sm leading-relaxed text-charcoal/70">
                        {listing.location}
                    </p>
                    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
                        {specs.map((spec) => (
                            <li key={spec.text} className="inline-flex items-center gap-1">
                                <spec.icon size={16} aria-hidden="true" />
                                {spec.text}
                            </li>
                        ))}
                    </ul>
                    <p className="m-0 text-sm text-charcoal/60">
                        {getLocaleValue(messages, ["catalog", "updated"])}{" "}
                        {formatListingDate(listing.updatedAt, locale)}
                    </p>
                </Link>
            </div>
        </article>
    );
}

export default function ListingBrowser({
    app,
}: {
    /** Trong ứng dụng: gốc của vùng làm việc (/app hoặc /admin). Không truyền thì là trang công khai /nha-dat. */
    app?: { root: ShellRoot };
} = {}) {
    const router = useRouter();
    const params = useSearchParams();
    const { locale } = useLocale();
    const messages = useLocaleMessages("landing");
    const query = params.get("q") ?? "";
    const purpose = readPurpose(params.get("purpose"));
    const kinds = readCsv(params.get("kind"), LISTING_KINDS);
    const districts = readCsv(params.get("district"), DISTRICTS);
    const price = params.get("price") ?? "";
    const sort = readSort(params.get("sort"));
    const view = params.get("view") === "list" ? "list" : "grid";
    const [draft, setDraft] = useState(query);
    const [syncedQuery, setSyncedQuery] = useState(query);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [columns, setColumns] = useState(5);
    const interestRaw = useSyncExternalStore(subscribeInterest, readInterestRaw, () => "");
    const draftsRaw = useSyncExternalStore(subscribeNothing, readDraftsRaw, () => "");
    const interest = useMemo(() => parseInterest(interestRaw), [interestRaw]);
    const drafts = useMemo(() => parseDrafts(draftsRaw), [draftsRaw]);
    const searchTimer = useRef<number | null>(null);
    const resultsHost = useRef<HTMLDivElement>(null);
    const basePath = app ? `${app.root}/properties` : "/nha-dat";
    const watch = Boolean(app) && params.get("watch") === "1";
    const vi = locale === "vi";

    if (query !== syncedQuery) {
        setSyncedQuery(query);
        setDraft(query);
    }

    useEffect(() => {
        return () => {
            if (searchTimer.current !== null) {
                window.clearTimeout(searchTimer.current);
            }
        };
    }, []);

    useEffect(() => {
        const node = resultsHost.current;

        if (!node) {
            return;
        }

        const measure = (): void => setColumns(columnsForWidth(node.clientWidth));

        measure();
        const observer = new ResizeObserver(measure);

        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    function toggleInterest(id: string): void {
        const next = new Set(interest);

        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }

        try {
            sessionStorage.setItem(INTEREST_KEY, JSON.stringify([...next]));
        } catch {
            // Trình duyệt chặn lưu trữ: không lưu được, danh sách vẫn như cũ.
        }

        interestListeners.forEach((listener) => listener());
    }

    function text(path: string[]): string {
        return getLocaleValue(messages, path);
    }

    function commit(patch: Record<string, string | null>, resetPage = true): void {
        const next = new URLSearchParams(params.toString());

        for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === "") {
                next.delete(key);
            } else {
                next.set(key, value);
            }
        }

        if (resetPage) {
            next.delete("page");
        }

        const queryString = next.toString();
        router.replace(queryString ? `${basePath}?${queryString}` : basePath, {
            scroll: false,
        });
    }

    function onSearch(value: string): void {
        setDraft(value);

        if (searchTimer.current !== null) {
            window.clearTimeout(searchTimer.current);
        }

        searchTimer.current = window.setTimeout(() => {
            commit({ q: value.trim() || null });
        }, 250);
    }

    function onPurpose(next: "" | ListingPurpose): void {
        const ranges = next === "thue" ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
        const priceStillValid = ranges.some((item) => item.id === price);

        commit({
            purpose: next || null,
            price: price && priceStillValid ? price : null,
        });
    }

    function resetFilters(): void {
        if (searchTimer.current !== null) {
            window.clearTimeout(searchTimer.current);
        }

        setDraft("");
        commit({
            q: null,
            purpose: null,
            kind: null,
            district: null,
            price: null,
            watch: null,
        });
    }

    const listings = app ? [...drafts, ...LISTINGS] : LISTINGS;
    const needle = fold(query.trim());
    const results = listings.filter((listing) => {
        if (watch && !interest.has(listing.id)) {
            return false;
        }

        if (purpose && listing.purpose !== purpose) {
            return false;
        }

        if (kinds.length > 0 && !kinds.includes(listing.kind)) {
            return false;
        }

        if (districts.length > 0 && !districts.includes(listing.district)) {
            return false;
        }

        if (!matchesPrice(listing, price, purpose)) {
            return false;
        }

        if (!needle) {
            return true;
        }

        return fold(`${listing.title} ${listing.location} ${listing.district}`).includes(
            needle,
        );
    }).sort((left, right) => compareListings(left, right, sort));

    const pageSize = view === "list" ? LIST_PAGE_SIZE : columns * GRID_ROWS;
    const totalPages = Math.ceil(results.length / pageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(readPage(params.get("page")), totalPages);
    const pageItems = results.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    function onPageChange(page: number): void {
        commit({ page: page <= 1 ? null : String(page) }, false);
        document.getElementById("ket-qua")?.scrollIntoView({ block: "start" });
    }

    const priceRanges = purpose === "thue" ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
    const priceGroup = purpose === "thue" ? "rentPrices" : "salePrices";
    const hasFilters = Boolean(
        query || purpose || kinds.length > 0 || districts.length > 0 || price || watch,
    );
    const districtOptions = DISTRICTS.filter((district) =>
        listings.some((listing) => listing.district === district),
    );

    const chips: { key: string; label: string; clear: Record<string, string | null> }[] =
        [];

    if (query) {
        chips.push({ key: "q", label: query, clear: { q: null } });
    }

    if (purpose) {
        chips.push({
            key: "purpose",
            label: text(["catalog", purpose === "ban" ? "purposeBan" : "purposeThue"]),
            clear: { purpose: null, price: null },
        });
    }

    for (const kind of kinds) {
        chips.push({
            key: `kind-${kind}`,
            label: text(["catalog", "kinds", kind]),
            clear: { kind: toggleCsv(kinds, kind) },
        });
    }

    for (const district of districts) {
        chips.push({
            key: `district-${district}`,
            label: district,
            clear: { district: toggleCsv(districts, district) },
        });
    }

    if (price && priceRanges.some((item) => item.id === price)) {
        chips.push({
            key: "price",
            label: text(["catalog", priceGroup, price]),
            clear: { price: null },
        });
    }

    if (watch) {
        chips.push({
            key: "watch",
            label: vi ? "Đã quan tâm" : "Watching",
            clear: { watch: null },
        });
    }

    const optionClass =
        "flex min-h-11 cursor-pointer items-center gap-2 text-sm leading-snug";

    return (
        <div
            className={`box-border px-4 py-8 sm:px-8 ${app ? "" : "xl:px-50"}`}
        >
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="max-w-3xl">
                    <h1 className="m-0 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                        {text(["catalog", "title"])}
                    </h1>
                    <p className="mt-3 max-w-xl text-base leading-relaxed text-charcoal/75">
                        {text(["catalog", "lede"])}
                    </p>
                </div>
                {app ? (
                    <div className="flex flex-wrap items-center gap-3">
                        {app.root === "/admin" ? (
                            <Link
                                href={`${app.root}/properties/new`}
                                className="inline-flex min-h-11 items-center rounded-full bg-green px-4 font-semibold text-cream no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                            >
                                {vi ? "Đăng tin mới" : "New listing"}
                            </Link>
                        ) : null}
                        <Link
                            href={`${app.root}/map`}
                            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        >
                            {vi ? "Mở bản đồ" : "Open the map"}
                        </Link>
                    </div>
                ) : null}
            </header>
            <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                    <label htmlFor="tim-nha-dat" className="mb-1 block text-sm font-medium">
                        {text(["catalog", "searchLabel"])}
                    </label>
                    <input
                        id="tim-nha-dat"
                        type="search"
                        value={draft}
                        placeholder={text(["catalog", "searchPlaceholder"])}
                        autoComplete="off"
                        className={FIELD_CLASS}
                        onChange={(event) => onSearch(event.target.value)}
                    />
                </div>
                <div className="lg:w-56">
                    <label htmlFor="sap-xep" className="mb-1 block text-sm font-medium">
                        {text(["catalog", "sortLabel"])}
                    </label>
                    <select
                        id="sap-xep"
                        value={sort}
                        className={FIELD_CLASS}
                        onChange={(event) =>
                            commit({
                                sort:
                                    event.target.value === "updated"
                                        ? null
                                        : event.target.value,
                            })
                        }
                    >
                        {SORT_KEYS.map((key) => (
                            <option key={key} value={key}>
                                {text(["catalog", "sort", key])}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <p id="kieu-xem" className="mb-1 text-sm font-medium">
                        {text(["catalog", "viewLabel"])}
                    </p>
                    <div role="group" aria-labelledby="kieu-xem" className="flex">
                        {(
                            [
                                ["grid", LayoutGrid, "viewGrid"],
                                ["list", List, "viewList"],
                            ] as const
                        ).map(([key, Icon, labelKey]) => {
                            const selected = view === key;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={selected}
                                    className={`inline-flex min-h-11 items-center gap-2 border px-3 first:rounded-l-full last:rounded-r-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${selected ? "border-green bg-green text-cream" : "border-charcoal/20 bg-white text-charcoal"}`}
                                    onClick={() =>
                                        commit({ view: key === "grid" ? null : "list" })
                                    }
                                >
                                    <Icon size={18} aria-hidden="true" />
                                    {text(["catalog", labelKey])}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-charcoal/20 bg-white px-4 lg:hidden"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen((open) => !open)}
                >
                    <SlidersHorizontal size={18} aria-hidden="true" />
                    {text(["catalog", filtersOpen ? "hideFilters" : "showFilters"])}
                </button>
            </div>
            <div className="mt-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
                <aside
                    aria-label={text(["catalog", "filters"])}
                    className={`${filtersOpen ? "mb-6 block" : "hidden"} lg:sticky lg:top-0 lg:mb-0 lg:block lg:max-h-[100cqh] lg:overflow-auto`}
                >
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="m-0 text-base font-semibold">
                            {text(["catalog", "filters"])}
                        </p>
                        {hasFilters ? (
                            <button
                                type="button"
                                className="inline-flex min-h-11 items-center text-sm text-green"
                                onClick={resetFilters}
                            >
                                {text(["catalog", "reset"])}
                            </button>
                        ) : null}
                    </div>
                    <fieldset className="m-0 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold">
                            {text(["catalog", "purpose"])}
                        </legend>
                        {(
                            [
                                ["", "purposeAll"],
                                ["ban", "purposeBan"],
                                ["thue", "purposeThue"],
                            ] as const
                        ).map(([value, labelKey]) => (
                            <label key={labelKey} className={optionClass}>
                                <input
                                    type="radio"
                                    name="muc-dich"
                                    className="size-4 accent-green"
                                    checked={purpose === value}
                                    onChange={() => onPurpose(value)}
                                />
                                {text(["catalog", labelKey])}
                            </label>
                        ))}
                    </fieldset>
                    <fieldset className="m-0 mt-4 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold">
                            {text(["catalog", "kind"])}
                        </legend>
                        {LISTING_KINDS.map((kind) => (
                            <label key={kind} className={optionClass}>
                                <input
                                    type="checkbox"
                                    className="size-4 accent-green"
                                    checked={kinds.includes(kind)}
                                    onChange={() =>
                                        commit({ kind: toggleCsv(kinds, kind) })
                                    }
                                />
                                {text(["catalog", "kinds", kind])}
                            </label>
                        ))}
                    </fieldset>
                    <fieldset className="m-0 mt-4 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold">
                            {text(["catalog", "district"])}
                        </legend>
                        {districtOptions.map((district) => (
                            <label key={district} className={optionClass}>
                                <input
                                    type="checkbox"
                                    className="size-4 accent-green"
                                    checked={districts.includes(district)}
                                    onChange={() =>
                                        commit({
                                            district: toggleCsv(districts, district),
                                        })
                                    }
                                />
                                {district}
                            </label>
                        ))}
                    </fieldset>
                    <fieldset className="m-0 mt-4 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold">
                            {text(["catalog", "price"])}
                        </legend>
                        <label className={optionClass}>
                            <input
                                type="radio"
                                name="khoang-gia"
                                className="size-4 accent-green"
                                checked={price === ""}
                                onChange={() => commit({ price: null })}
                            />
                            {text(["catalog", "priceAny"])}
                        </label>
                        {priceRanges.map((range) => (
                            <label key={range.id} className={optionClass}>
                                <input
                                    type="radio"
                                    name="khoang-gia"
                                    className="size-4 accent-green"
                                    checked={price === range.id}
                                    onChange={() => commit({ price: range.id })}
                                />
                                {text(["catalog", priceGroup, range.id])}
                            </label>
                        ))}
                        {purpose === "" ? (
                            <p className="mt-1 mb-0 text-sm leading-relaxed text-charcoal/70">
                                {text(["catalog", "priceHint"])}
                            </p>
                        ) : null}
                    </fieldset>
                    {app ? (
                        <fieldset className="m-0 mt-4 border-0 p-0">
                            <legend className="mb-1 text-sm font-semibold">
                                {vi ? "Quan tâm" : "Watching"}
                            </legend>
                            <label className={optionClass}>
                                <input
                                    type="checkbox"
                                    className="size-4 accent-green"
                                    checked={watch}
                                    onChange={() => commit({ watch: watch ? null : "1" })}
                                />
                                {vi
                                    ? `Chỉ tin đã quan tâm (${interest.size})`
                                    : `Watched only (${interest.size})`}
                            </label>
                        </fieldset>
                    ) : null}
                </aside>
                <div id="ket-qua" ref={resultsHost} className="min-w-0 scroll-mt-4">
                    {chips.length > 0 ? (
                        <ul className="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
                            {chips.map((chip) => (
                                <li key={chip.key}>
                                    <button
                                        type="button"
                                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/15 bg-white px-3 text-sm"
                                        aria-label={`${text(["catalog", "remove"])} ${chip.label}`}
                                        onClick={() => {
                                            if (chip.key === "q") {
                                                setDraft("");
                                            }

                                            commit(chip.clear);
                                        }}
                                    >
                                        {chip.label}
                                        <X size={14} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <p className="m-0 mb-4 text-sm tabular-nums" aria-live="polite">
                        {results.length} {text(["catalog", "resultUnit"])}
                    </p>
                    {results.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-charcoal/25 px-6 py-10">
                            <p className="m-0 text-base">{text(["catalog", "empty"])}</p>
                            <button
                                type="button"
                                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-green px-5 text-cream"
                                onClick={resetFilters}
                            >
                                {text(["catalog", "reset"])}
                            </button>
                        </div>
                    ) : (
                        <div
                            className={view === "list" ? "flex flex-col gap-4" : "grid gap-4"}
                            style={
                                view === "list"
                                    ? undefined
                                    : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                            }
                        >
                            {pageItems.map((listing, index) => (
                                <ListingCard
                                    key={listing.id}
                                    listing={listing}
                                    messages={messages}
                                    locale={locale}
                                    view={view}
                                    eager={index < columns}
                                    href={app ? `${app.root}/properties/${listing.slug}` : listingPath(listing)}
                                    interest={
                                        app
                                            ? {
                                                  on: interest.has(listing.id),
                                                  label: interest.has(listing.id)
                                                      ? vi
                                                          ? "Bỏ quan tâm"
                                                          : "Stop watching"
                                                      : vi
                                                        ? "Quan tâm"
                                                        : "Watch",
                                                  toggle: () => toggleInterest(listing.id),
                                              }
                                            : undefined
                                    }
                                />
                            ))}
                        </div>
                    )}
                    {totalPages > 1 ? (
                        <div className="mt-8">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={onPageChange}
                                labels={{
                                    nav: text(["catalog", "pagination"]),
                                    previous: text(["catalog", "pagePrevious"]),
                                    next: text(["catalog", "pageNext"]),
                                    first: text(["catalog", "pageFirst"]),
                                    last: text(["catalog", "pageLast"]),
                                    page: text(["catalog", "page"]),
                                }}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
