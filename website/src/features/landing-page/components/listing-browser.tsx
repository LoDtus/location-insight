"use client";

import {
    Bath,
    Bed,
    LayoutGrid,
    List,
    Ruler,
    SlidersHorizontal,
    Sofa,
    X,
    type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
    type Listing,
    type ListingPurpose,
    type SortKey,
} from "@/features/landing-page/data/listings";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import type { LocaleMessages } from "@/shared/types/locale.types";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const PAGE_SIZE = 6;

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
}: {
    listing: Listing;
    messages: LocaleMessages;
    locale: string;
    view: "grid" | "list";
    eager: boolean;
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
                <ListingGallery
                    images={listing.images}
                    label={listing.title}
                    previousLabel={getLocaleValue(messages, ["catalog", "previous"])}
                    nextLabel={getLocaleValue(messages, ["catalog", "next"])}
                    eager={eager}
                />
                <div className="flex min-w-0 flex-col gap-2 p-4">
                    <div className="flex items-baseline justify-between gap-3">
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
                </div>
            </div>
        </article>
    );
}

export default function ListingBrowser() {
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
    const searchTimer = useRef<number | null>(null);

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
        router.replace(queryString ? `/nha-dat?${queryString}` : "/nha-dat", {
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
        });
    }

    const needle = fold(query.trim());
    const results = LISTINGS.filter((listing) => {
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

    const totalPages = Math.ceil(results.length / PAGE_SIZE);
    const currentPage = totalPages === 0 ? 1 : Math.min(readPage(params.get("page")), totalPages);
    const pageItems = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    function onPageChange(page: number): void {
        commit({ page: page <= 1 ? null : String(page) }, false);
        document.getElementById("ket-qua")?.scrollIntoView({ block: "start" });
    }

    const priceRanges = purpose === "thue" ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
    const priceGroup = purpose === "thue" ? "rentPrices" : "salePrices";
    const hasFilters = Boolean(
        query || purpose || kinds.length > 0 || districts.length > 0 || price,
    );
    const districtOptions = DISTRICTS.filter((district) =>
        LISTINGS.some((listing) => listing.district === district),
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

    const optionClass =
        "flex min-h-11 cursor-pointer items-center gap-2 text-sm leading-snug";

    return (
        <div className="box-border px-4 py-8 sm:px-8 xl:px-50">
            <header className="max-w-3xl">
                <h1 className="m-0 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                    {text(["catalog", "title"])}
                </h1>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-charcoal/75">
                    {text(["catalog", "lede"])}
                </p>
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
            <div className="mt-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-10">
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
                </aside>
                <div id="ket-qua" className="min-w-0 scroll-mt-4">
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
                            className={
                                view === "list"
                                    ? "flex flex-col gap-4"
                                    : "grid grid-cols-1 gap-4 sm:grid-cols-2"
                            }
                        >
                            {pageItems.map((listing, index) => (
                                <ListingCard
                                    key={listing.id}
                                    listing={listing}
                                    messages={messages}
                                    locale={locale}
                                    view={view}
                                    eager={index < 2}
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
