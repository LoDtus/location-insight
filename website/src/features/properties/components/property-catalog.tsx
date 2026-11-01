"use client";

import { Heart, SlidersHorizontal, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
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
    listingBadges,
    type Listing,
    type ListingBadge,
    type ListingKind,
    type ListingPurpose,
    type SortKey,
} from "@/features/landing-page/data/listings";
import { readDrafts } from "@/features/properties/property-drafts";
import Pagination from "@/shared/components/ui/pagination";
import { useLocale } from "@/shared/hooks/useLocale";

const PAGE_SIZE = 9;
const INTEREST_KEY = "property-interest";

const FIELD_CLASS =
    "box-border min-h-11 w-full rounded-full border border-charcoal/20 bg-white px-4 text-sm text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

const BADGE_LABEL: Record<ListingBadge, { vi: string; en: string }> = {
    moi: { vi: "Mới", en: "New" },
    "gia-tot": { vi: "Giá tốt", en: "Fair price" },
    "quan-tam": { vi: "Quan tâm nhiều", en: "Most watched" },
};

const KIND_LABEL: Record<ListingKind, { vi: string; en: string }> = {
    "can-ho": { vi: "Căn hộ", en: "Apartment" },
    "nha-pho": { vi: "Nhà phố", en: "Townhouse" },
    "biet-thu": { vi: "Biệt thự", en: "Villa" },
    dat: { vi: "Đất", en: "Land" },
};

function fold(value: string): string {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function readPurpose(value: string | null): "" | ListingPurpose {
    if (value === "ban" || value === "thue") return value;
    return "";
}

function readPage(value: string | null): number {
    const page = Number(value);
    if (!Number.isInteger(page) || page < 1) return 1;
    return page;
}

function readSort(value: string | null): SortKey {
    if (value !== null && (SORT_KEYS as readonly string[]).includes(value)) return value as SortKey;
    return "updated";
}

function readKind(value: string | null): "" | ListingKind {
    if (value !== null && (LISTING_KINDS as readonly string[]).includes(value)) return value as ListingKind;
    return "";
}

function readDistrict(value: string | null): string {
    if (value !== null && (DISTRICTS as readonly string[]).includes(value)) return value;
    return "";
}

function readPrice(value: string | null, purpose: "" | ListingPurpose): string {
    if (!purpose || !value) return "";
    const ranges = purpose === "thue" ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
    return ranges.some((item) => item.id === value) ? value : "";
}

function toCanonical(source: URLSearchParams, totalPages: number): URLSearchParams {
    const purpose = readPurpose(source.get("purpose"));
    const next = new URLSearchParams();
    next.set("q", (source.get("q") ?? "").trim());
    next.set("purpose", purpose);
    next.set("kind", readKind(source.get("kind")));
    next.set("district", readDistrict(source.get("district")));
    next.set("price", readPrice(source.get("price"), purpose));
    next.set("sort", readSort(source.get("sort")));
    const page = Math.min(readPage(source.get("page")), Math.max(1, totalPages));
    next.set("page", String(page));
    next.set("watch", source.get("watch") === "1" ? "1" : "0");
    return next;
}

function matchesPrice(listing: Listing, priceId: string, purpose: "" | ListingPurpose): boolean {
    if (!priceId) return true;
    const ranges = purpose === "thue" ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
    const range = ranges.find((item) => item.id === priceId);
    if (!range) return true;
    if (listing.purpose !== (purpose === "thue" ? "thue" : "ban")) return false;
    return listing.priceVnd >= range.min && listing.priceVnd < range.max;
}

function compareListings(left: Listing, right: Listing, sort: SortKey): number {
    if (sort === "price-asc") return left.priceVnd - right.priceVnd;
    if (sort === "price-desc") return right.priceVnd - left.priceVnd;
    if (sort === "area") return right.areaM2 - left.areaM2;
    return right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
}

function readInterest(): Set<string> {
    try {
        const raw = sessionStorage.getItem(INTEREST_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((item): item is string => typeof item === "string"));
    } catch {
        return new Set();
    }
}

export default function PropertyCatalog({ root }: { root: ShellRoot }): JSX.Element {
    const router = useRouter();
    const params = useSearchParams();
    const { locale } = useLocale();
    const vi = locale === "vi";
    const query = (params.get("q") ?? "").trim();
    const purpose = readPurpose(params.get("purpose"));
    const kind = readKind(params.get("kind"));
    const district = readDistrict(params.get("district"));
    const price = readPrice(params.get("price"), purpose);
    const sort = readSort(params.get("sort"));
    const page = readPage(params.get("page"));
    const watch = params.get("watch") === "1";
    const [draft, setDraft] = useState(query);
    const [syncedQuery, setSyncedQuery] = useState(query);
    const [interest, setInterest] = useState<Set<string>>(new Set());
    const [drafts, setDrafts] = useState<Listing[]>([]);
    const [storedReady, setStoredReady] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const searchTimer = useRef<number | null>(null);
    const closeFiltersRef = useRef<HTMLButtonElement>(null);
    const surfaceClass = root === "/admin" ? "bg-white" : "bg-cream";

    if (query !== syncedQuery) {
        setSyncedQuery(query);
        setDraft(query);
    }

    const listings = [...drafts, ...LISTINGS];
    const needle = fold(query);
    const results = listings
        .filter((listing) => {
            if (watch && storedReady && !interest.has(listing.id)) return false;
            if (purpose && listing.purpose !== purpose) return false;
            if (kind && listing.kind !== kind) return false;
            if (district && listing.district !== district) return false;
            if (!matchesPrice(listing, price, purpose)) return false;
            if (!needle) return true;
            return fold(`${listing.title} ${listing.location} ${listing.district}`).includes(needle);
        })
        .sort((left, right) => compareListings(left, right, sort));

    const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);

    useEffect(() => {
        setInterest(readInterest());
        setDrafts(readDrafts());
        setStoredReady(true);
    }, []);

    useEffect(() => {
        return () => {
            if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
        };
    }, []);

    useEffect(() => {
        const canonical = toCanonical(new URLSearchParams(params.toString()), totalPages).toString();
        if (canonical !== params.toString()) {
            router.replace(`${root}/properties?${canonical}`, { scroll: false });
        }
    }, [params, root, router, totalPages]);

    useEffect(() => {
        if (!filtersOpen) return;
        closeFiltersRef.current?.focus();
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") setFiltersOpen(false);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [filtersOpen]);

    function text(viText: string, enText: string): string {
        return vi ? viText : enText;
    }

    function commit(patch: Record<string, string | null>, resetPage = true): void {
        const next = new URLSearchParams(params.toString());
        if (resetPage) next.set("page", "1");
        for (const [key, value] of Object.entries(patch)) {
            if (value === null) next.delete(key);
            else next.set(key, value);
        }
        const canonical = toCanonical(next, totalPages).toString();
        router.replace(`${root}/properties?${canonical}`, { scroll: false });
    }

    function onSearch(value: string): void {
        setDraft(value);
        if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
        searchTimer.current = window.setTimeout(() => {
            commit({ q: value.trim() });
        }, 250);
    }

    function onPurpose(next: "" | ListingPurpose): void {
        const ranges = next === "thue" ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
        const priceStillValid = ranges.some((item) => item.id === price);
        commit({
            purpose: next,
            price: next !== "" && priceStillValid ? price : "",
        });
    }

    function resetFilters(): void {
        if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
        setDraft("");
        commit({ q: "", purpose: "", kind: "", district: "", price: "", sort: "updated", watch: "0" });
    }

    function toggleInterest(id: string): void {
        setInterest((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            sessionStorage.setItem(INTEREST_KEY, JSON.stringify([...next]));
            return next;
        });
    }

    const pageItems = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const priceRanges = purpose === "thue" ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
    const priceLabels: Record<string, string> = purpose === "thue"
        ? { "under-10": text("Dưới 10 triệu", "Under 10 million"), "10-20": text("10–20 triệu", "10–20 million"), "20-40": text("20–40 triệu", "20–40 million"), "over-40": text("Trên 40 triệu", "Over 40 million") }
        : { "under-3": text("Dưới 3 tỷ", "Under 3 billion"), "3-7": text("3–7 tỷ", "3–7 billion"), "7-15": text("7–15 tỷ", "7–15 billion"), "over-15": text("Trên 15 tỷ", "Over 15 billion") };
    const activePrice = priceRanges.find((item) => item.id === price);
    const sortLabel = sort === "price-asc"
        ? text("Giá tăng dần", "Price ascending")
        : sort === "price-desc"
          ? text("Giá giảm dần", "Price descending")
          : sort === "area"
            ? text("Diện tích lớn nhất", "Largest area")
            : text("Mới cập nhật", "Recently updated");
    const activeCount = [purpose, kind, district, price, sort !== "updated" ? sort : ""].filter(Boolean).length;
    const hasFilters = Boolean(query || purpose || kind || district || price || sort !== "updated" || watch);

    return (
        <main className={`box-border h-full overflow-auto px-4 pb-8 sm:px-8 ${surfaceClass}`}>
            <header className="flex flex-wrap items-end justify-between gap-3 pt-8">
                <div>
                    <h1 className="m-0 text-2xl font-semibold">{text("Tin rao bán", "For sale")}</h1>
                    <p className="mt-1 mb-0 text-sm text-charcoal/75">
                        {text(`${results.length} nhà đất`, `${results.length} listings`)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {root === "/admin" ? (
                        <Link
                            href={`${root}/properties/new`}
                            className="inline-flex min-h-11 items-center rounded-full bg-green px-4 font-semibold text-cream no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        >
                            {text("Đăng tin mới", "New listing")}
                        </Link>
                    ) : null}
                    <Link
                        href={`${root}/map`}
                        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    >
                        {text("Mở bản đồ", "Open the map")}
                    </Link>
                </div>
            </header>

            <div className={`sticky top-0 z-20 -mx-4 mt-6 border-b border-charcoal/10 px-4 py-3 sm:-mx-8 sm:px-8 ${surfaceClass}`}>
                <form
                    className="flex items-center gap-2"
                    role="search"
                    onSubmit={(event) => {
                        event.preventDefault();
                        commit({ q: draft.trim() });
                    }}
                >
                    <label className="sr-only" htmlFor="tim-nha-dat">
                        {text("Tìm nhà đất", "Search listings")}
                    </label>
                    <input
                        id="tim-nha-dat"
                        className={`${FIELD_CLASS} min-w-0 flex-1`}
                        value={draft}
                        placeholder={text("Tên hoặc khu vực", "Name or area")}
                        onChange={(event) => onSearch(event.target.value)}
                    />
                    <button
                        type="button"
                        className={`relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${watch ? "border-green bg-green text-cream" : "border-charcoal/20 bg-white text-charcoal"}`}
                        aria-pressed={watch}
                        aria-label={text(`Đã quan tâm, ${interest.size} tin`, `Watching, ${interest.size} listings`)}
                        onClick={() => commit({ watch: watch ? "0" : "1" }, false)}
                    >
                        <Heart className={`size-5 ${watch || interest.size > 0 ? "fill-current" : ""}`} aria-hidden="true" />
                        <span className={`absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ${watch ? "bg-cream text-green" : "bg-green text-cream"}`}>
                            {interest.size}
                        </span>
                    </button>
                    <button
                        type="button"
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-charcoal/20 bg-white px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        aria-expanded={filtersOpen}
                        aria-controls="bo-loc-nha-dat"
                        onClick={() => setFiltersOpen(true)}
                    >
                        <SlidersHorizontal className="size-4" aria-hidden="true" />
                        {text("Bộ lọc", "Filters")}
                        {activeCount > 0 ? (
                            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-green px-1 text-xs text-cream tabular-nums">
                                {activeCount}
                            </span>
                        ) : null}
                    </button>
                </form>
                {hasFilters ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {query ? <FilterTag label={query} removeLabel={text(`Bỏ ${query}`, `Remove ${query}`)} onRemove={() => { setDraft(""); commit({ q: "" }); }} /> : null}
                        {purpose ? <FilterTag label={purpose === "ban" ? text("Bán", "For sale") : text("Cho thuê", "For rent")} removeLabel={text("Bỏ hình thức", "Remove offer")} onRemove={() => onPurpose("")} /> : null}
                        {kind ? <FilterTag label={text(KIND_LABEL[kind].vi, KIND_LABEL[kind].en)} removeLabel={text("Bỏ phân loại", "Remove type")} onRemove={() => commit({ kind: "" })} /> : null}
                        {district ? <FilterTag label={district} removeLabel={text(`Bỏ ${district}`, `Remove ${district}`)} onRemove={() => commit({ district: "" })} /> : null}
                        {activePrice ? <FilterTag label={priceLabels[activePrice.id] ?? ""} removeLabel={text("Bỏ khoảng giá", "Remove price")} onRemove={() => commit({ price: "" })} /> : null}
                        {sort !== "updated" ? <FilterTag label={sortLabel} removeLabel={text("Bỏ sắp xếp", "Remove sort")} onRemove={() => commit({ sort: "updated" }, false)} /> : null}
                        {watch ? <FilterTag label={text("Đã quan tâm", "Watching")} removeLabel={text("Bỏ lọc quan tâm", "Remove watching filter")} onRemove={() => commit({ watch: "0" }, false)} /> : null}
                        <button
                            type="button"
                            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                            onClick={resetFilters}
                        >
                            {text("Xóa bộ lọc", "Clear filters")}
                        </button>
                    </div>
                ) : null}
            </div>

            {filtersOpen ? (
                <div className="fixed inset-0 z-40">
                    <button
                        type="button"
                        className="absolute inset-0 bg-charcoal/40"
                        aria-label={text("Đóng bộ lọc", "Close filters")}
                        onClick={() => setFiltersOpen(false)}
                    />
                    <aside id="bo-loc-nha-dat" className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-sm" aria-label={text("Bộ lọc và sắp xếp", "Filters and sort")}>
                        <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-3">
                            <h2 className="m-0 text-lg font-semibold">{text("Bộ lọc", "Filters")}</h2>
                            <button
                                ref={closeFiltersRef}
                                type="button"
                                className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                aria-label={text("Đóng bộ lọc", "Close filters")}
                                onClick={() => setFiltersOpen(false)}
                            >
                                <X className="size-5" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="grid flex-1 content-start gap-4 overflow-auto p-4">
                            <label className="flex flex-col gap-1 text-sm">
                                {text("Hình thức", "Offer")}
                                <select className={FIELD_CLASS} value={purpose} onChange={(event) => onPurpose(readPurpose(event.target.value))}>
                                    <option value="">{text("Bán và cho thuê", "Sale and rent")}</option>
                                    <option value="ban">{text("Bán", "For sale")}</option>
                                    <option value="thue">{text("Cho thuê", "For rent")}</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                                {text("Phân loại", "Type")}
                                <select className={FIELD_CLASS} value={kind} onChange={(event) => commit({ kind: readKind(event.target.value) })}>
                                    <option value="">{text("Mọi loại", "All types")}</option>
                                    {LISTING_KINDS.map((item) => (
                                        <option key={item} value={item}>
                                            {text(KIND_LABEL[item].vi, KIND_LABEL[item].en)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                                {text("Khu vực", "Area")}
                                <select className={FIELD_CLASS} value={district} onChange={(event) => commit({ district: readDistrict(event.target.value) })}>
                                    <option value="">{text("Mọi khu vực", "All areas")}</option>
                                    {DISTRICTS.map((item) => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                                {text("Khoảng giá", "Price")}
                                <select
                                    className={FIELD_CLASS}
                                    value={activePrice ? price : ""}
                                    disabled={purpose === ""}
                                    onChange={(event) => commit({ price: event.target.value })}
                                >
                                    <option value="">{purpose === "" ? text("Chọn bán hoặc thuê trước", "Choose sale or rent first") : text("Mọi mức giá", "Any price")}</option>
                                    {purpose === ""
                                        ? null
                                        : priceRanges.map((item) => (
                                              <option key={item.id} value={item.id}>
                                                  {priceLabels[item.id]}
                                              </option>
                                          ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                                {text("Sắp xếp", "Sort")}
                                <select className={FIELD_CLASS} value={sort} onChange={(event) => commit({ sort: readSort(event.target.value) }, false)}>
                                    <option value="updated">{text("Mới cập nhật", "Recently updated")}</option>
                                    <option value="price-asc">{text("Giá tăng dần", "Price ascending")}</option>
                                    <option value="price-desc">{text("Giá giảm dần", "Price descending")}</option>
                                    <option value="area">{text("Diện tích lớn nhất", "Largest area")}</option>
                                </select>
                            </label>
                        </div>
                        <div className="border-t border-charcoal/10 p-4">
                            <button
                                type="button"
                                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                onClick={resetFilters}
                            >
                                {text("Xóa bộ lọc", "Clear filters")}
                            </button>
                        </div>
                    </aside>
                </div>
            ) : null}

            {pageItems.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-charcoal/15 bg-white px-4 py-10 text-center">
                    <p className="m-0 text-base font-semibold">{text("Không có nhà đất khớp bộ lọc.", "No listings match these filters.")}</p>
                    <button
                        type="button"
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        onClick={resetFilters}
                    >
                        {text("Xóa bộ lọc", "Clear filters")}
                    </button>
                </div>
            ) : (
                <ul className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
                    {pageItems.map((listing) => (
                        <li key={listing.id} className="min-w-0">
                            <PropertyCard
                                listing={listing}
                                href={`${root}/properties/${listing.slug}`}
                                locale={locale}
                                vi={vi}
                                interested={interest.has(listing.id)}
                                onToggleInterest={() => toggleInterest(listing.id)}
                            />
                        </li>
                    ))}
                </ul>
            )}

            {totalPages > 1 ? (
                <div className="mt-6 flex justify-center">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        mode="short"
                        onPageChange={(next) => commit({ page: String(next) }, false)}
                        labels={{
                            nav: text("Phân trang", "Pagination"),
                            previous: text("Trang trước", "Previous page"),
                            next: text("Trang sau", "Next page"),
                            first: text("Trang đầu", "First page"),
                            last: text("Trang cuối", "Last page"),
                            page: text("Trang {page}", "Page {page}"),
                        }}
                    />
                </div>
            ) : null}
        </main>
    );
}

function FilterTag({ label, removeLabel, onRemove }: { label: string; removeLabel: string; onRemove: () => void }): JSX.Element {
    return (
        <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-charcoal/20 bg-white pr-1 pl-3 text-sm">
            <span className="max-w-48 truncate">{label}</span>
            <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                aria-label={removeLabel}
                onClick={onRemove}
            >
                <X className="size-4" aria-hidden="true" />
            </button>
        </span>
    );
}

function PropertyCard({
    listing,
    href,
    locale,
    vi,
    interested,
    onToggleInterest,
}: {
    listing: Listing;
    href: string;
    locale: string;
    vi: boolean;
    interested: boolean;
    onToggleInterest: () => void;
}): JSX.Element {
    const badges = listingBadges(listing);
    const watchers = listing.watchers + (interested ? 1 : 0);
    const purpose = listing.purpose === "ban" ? (vi ? "Bán" : "For sale") : vi ? "Cho thuê" : "For rent";

    return (
        <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal/15 bg-white">
            <Link href={href} className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green">
                <span className="sr-only">{listing.title}</span>
            </Link>
            <div className="relative">
                <Image src={listing.images[0]} alt="" width={640} height={480} className="aspect-[4/3] w-full object-cover" />
                {badges.length > 0 ? (
                    <ul className="absolute top-3 left-3 m-0 flex list-none flex-wrap gap-2 p-0">
                        {badges.map((badge) => (
                            <li
                                key={badge}
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge === "quan-tam" ? "bg-green text-cream" : "border border-charcoal/15 bg-white text-charcoal"}`}
                            >
                                {vi ? BADGE_LABEL[badge].vi : BADGE_LABEL[badge].en}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="m-0 text-sm text-charcoal/75">
                    {vi ? KIND_LABEL[listing.kind].vi : KIND_LABEL[listing.kind].en}
                    {" · "}
                    {purpose}
                </p>
                <h2 className="m-0 text-lg leading-snug font-semibold">{listing.title}</h2>
                <p className="m-0 text-sm leading-relaxed">{listing.location}</p>
                <p className="m-0 text-base font-semibold text-green tabular-nums">
                    {formatListingPrice(listing, locale)}
                    {" · "}
                    {formatArea(listing.areaM2, locale)}
                </p>
                <p className="m-0 text-sm text-charcoal/70">
                    {vi ? "Cập nhật" : "Updated"} {formatListingDate(listing.updatedAt, locale)}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    <button
                        type="button"
                        className={`relative z-20 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${interested ? "border-green bg-green text-cream" : "border-charcoal/20 bg-white text-charcoal"}`}
                        aria-pressed={interested}
                        onClick={onToggleInterest}
                    >
                        <Heart className={`size-4 ${interested ? "fill-current" : ""}`} aria-hidden="true" />
                        {interested ? (vi ? "Đã quan tâm" : "Watching") : vi ? "Quan tâm" : "Watch"}
                    </button>
                    <p className="m-0 text-sm tabular-nums text-charcoal/75">
                        {vi ? `${watchers} người quan tâm` : `${watchers} watching`}
                    </p>
                </div>
            </div>
        </article>
    );
}
