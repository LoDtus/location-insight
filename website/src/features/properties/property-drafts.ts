import {
    DISTRICTS,
    LISTING_KINDS,
    LISTING_PURPOSES,
    LISTINGS,
    type District,
    type Listing,
    type ListingKind,
    type ListingPurpose,
} from "@/features/landing-page/data/listings";

const DRAFT_KEY = "property-drafts";

function isPurpose(value: unknown): value is ListingPurpose {
    return typeof value === "string" && (LISTING_PURPOSES as readonly string[]).includes(value);
}

function isKind(value: unknown): value is ListingKind {
    return typeof value === "string" && (LISTING_KINDS as readonly string[]).includes(value);
}

function isDistrict(value: unknown): value is District {
    return typeof value === "string" && (DISTRICTS as readonly string[]).includes(value);
}

function isListing(value: unknown): value is Listing {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<Listing>;
    return (
        typeof item.id === "string" &&
        typeof item.slug === "string" &&
        typeof item.title === "string" &&
        typeof item.location === "string" &&
        isDistrict(item.district) &&
        isPurpose(item.purpose) &&
        isKind(item.kind) &&
        typeof item.priceVnd === "number" &&
        typeof item.areaM2 === "number" &&
        typeof item.beds === "number" &&
        typeof item.living === "number" &&
        typeof item.baths === "number" &&
        typeof item.updatedAt === "string" &&
        typeof item.watchers === "number" &&
        Array.isArray(item.images) &&
        item.images.every((image) => typeof image === "string") &&
        item.images.length > 0 &&
        (item.extra === undefined || (typeof item.extra === "object" && item.extra !== null))
    );
}

/** Chuỗi thô trong localStorage ("" khi chưa có hoặc bị chặn); dùng làm snapshot ổn định cho useSyncExternalStore. */
export function readDraftsRaw(): string {
    if (typeof window === "undefined") return "";
    try {
        return localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
        return "";
    }
}

export function parseDrafts(raw: string): Listing[] {
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isListing);
    } catch {
        return [];
    }
}

export function readDrafts(): Listing[] {
    return parseDrafts(readDraftsRaw());
}

export function saveDraft(listing: Listing): void {
    const next = [listing, ...readDrafts().filter((item) => item.id !== listing.id)];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
}

export function findDraft(slug: string): Listing | undefined {
    return readDrafts().find((item) => item.slug === slug || item.id === slug);
}

function slugify(value: string): string {
    const base = value
        .replace(/đ/gi, "d")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return base || "tin-rao";
}

export function uniqueListingSlug(title: string): string {
    const base = slugify(title);
    const taken = new Set([...LISTINGS.map((item) => item.slug), ...readDrafts().map((item) => item.slug)]);
    if (!taken.has(base)) return base;
    let index = 2;
    while (taken.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
}

export function todayInHanoi(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}
