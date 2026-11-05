import { inVietnam } from "@/features/map/map-url";
import type { MapPlaceKind } from "@/features/map/map.types";

/**
 * Lịch sử tìm kiếm gần nhất của ô tìm kiếm bản đồ, lưu tại trình duyệt (localStorage).
 * Xóa khi đăng xuất để người dùng sau trên cùng máy không thấy.
 */
export const SEARCH_HISTORY_KEY = "li:map-search-history";
export const SEARCH_HISTORY_MAX = 8;

export type SearchHistoryEntry =
    /** Đã chọn một địa điểm cụ thể: mở lại không cần gọi API. */
    | { type: "place"; text: string; lat: number; lng: number; address: string; kind?: MapPlaceKind; at: number }
    /** Tìm theo loại hình ("ngân hàng"): chạy lại tìm kiếm. */
    | { type: "query"; text: string; at: number };

type HistoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function localStore(): HistoryStorage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}

function clean(value: unknown, max: number): string {
    return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

/** Chỉ nhận dữ liệu đúng hình dạng (storage có thể bị sửa tay). */
function parseEntry(raw: unknown): SearchHistoryEntry | null {
    if (typeof raw !== "object" || raw === null) return null;
    const value = raw as Record<string, unknown>;
    const text = clean(value.text, 120);
    const at = typeof value.at === "number" && Number.isFinite(value.at) ? value.at : 0;
    if (text.length < 2) return null;
    if (value.type === "query") return { type: "query", text, at };
    if (value.type === "place" && typeof value.lat === "number" && typeof value.lng === "number" && inVietnam(value.lat, value.lng)) {
        return { type: "place", text, lat: value.lat, lng: value.lng, address: clean(value.address, 300), at };
    }
    return null;
}

export function readSearchHistory(storage: HistoryStorage | null = localStore()): SearchHistoryEntry[] {
    try {
        const raw = storage?.getItem(SEARCH_HISTORY_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(parseEntry).filter((entry): entry is SearchHistoryEntry => entry !== null).slice(0, SEARCH_HISTORY_MAX);
    } catch {
        return [];
    }
}

function sameEntry(a: SearchHistoryEntry, b: SearchHistoryEntry): boolean {
    return a.type === b.type && a.text.toLocaleLowerCase("vi") === b.text.toLocaleLowerCase("vi");
}

/** Thêm lên đầu (đóng dấu thời gian lúc thêm), bỏ bản trùng, giữ tối đa SEARCH_HISTORY_MAX. Trả về danh sách mới. */
export function pushSearchHistory(input: SearchHistoryEntry, storage: HistoryStorage | null = localStore()): SearchHistoryEntry[] {
    const entry = { ...input, at: Date.now() };
    const next = [entry, ...readSearchHistory(storage).filter((item) => !sameEntry(item, entry))].slice(0, SEARCH_HISTORY_MAX);
    try {
        storage?.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch {
        // storage đầy hoặc bị chặn: bỏ qua
    }
    return next;
}

export function removeSearchHistory(entry: SearchHistoryEntry, storage: HistoryStorage | null = localStore()): SearchHistoryEntry[] {
    const next = readSearchHistory(storage).filter((item) => !sameEntry(item, entry));
    try {
        storage?.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch {
        // bỏ qua
    }
    return next;
}

export function clearSearchHistory(storage: HistoryStorage | null = localStore()): void {
    try {
        storage?.removeItem(SEARCH_HISTORY_KEY);
    } catch {
        // bỏ qua
    }
}
