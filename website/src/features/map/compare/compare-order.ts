import type { CompareItem } from "@/features/map/map.types";

/**
 * Thứ tự trong bảng so sánh:
 * - Cột (địa điểm): lưu ở backend (PUT /map/compare/order), giống nhau trên mọi thiết bị.
 * - Dòng tiêu chí: tùy chọn hiển thị, lưu trong trình duyệt (xóa khi đăng xuất). Chỉ đổi chỗ trong cùng nhóm.
 */

export type OverallSort = "desc" | "asc";

/** Sắp cột theo điểm tổng; địa điểm chưa có điểm luôn nằm cuối, giữ thứ tự cũ giữa các mục bằng điểm. */
export function sortByOverall(items: readonly CompareItem[], direction: OverallSort): CompareItem[] {
    return items
        .map((item, index) => ({ item, index, score: item.evaluation?.overall ?? null }))
        .sort((a, b) => {
            if (a.score === null || b.score === null) return a.score === null ? (b.score === null ? a.index - b.index : 1) : -1;
            const diff = direction === "desc" ? b.score - a.score : a.score - b.score;
            return diff !== 0 ? diff : a.index - b.index;
        })
        .map((entry) => entry.item);
}

/** Đổi chỗ một phần tử từ vị trí `from` sang `to` (như arrayMove của dnd-kit, không đổi mảng gốc). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    const next = [...list];
    const [moved] = next.splice(from, 1);
    if (moved !== undefined) next.splice(to, 0, moved);
    return next;
}

/** Áp thứ tự đã lưu lên danh sách theo id: id đã lưu lên trước theo đúng thứ tự, id mới (chưa lưu) giữ thứ tự gốc ở sau. */
export function applyOrder<T>(list: readonly T[], idOf: (item: T) => string, saved: readonly string[] | undefined): T[] {
    if (!saved || saved.length === 0) return [...list];
    const rank = new Map(saved.map((id, index) => [id, index]));
    return list
        .map((item, index) => ({ item, index, rank: rank.get(idOf(item)) }))
        .sort((a, b) => {
            if (a.rank === undefined || b.rank === undefined) return a.rank === undefined ? (b.rank === undefined ? a.index - b.index : 1) : -1;
            return a.rank - b.rank;
        })
        .map((entry) => entry.item);
}

/* ---------------- Thứ tự dòng tiêu chí (trình duyệt) ---------------- */

const ROW_ORDER_KEY = "compare-row-order:v1";
export type RowOrder = Record<string, string[]>;

const EMPTY: RowOrder = {};
let cache: RowOrder | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): RowOrder {
    if (!raw) return EMPTY;
    try {
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY;
        const out: RowOrder = {};
        for (const [group, ids] of Object.entries(value)) {
            if (Array.isArray(ids) && ids.length <= 50 && ids.every((id) => typeof id === "string" && id.length <= 64)) out[group] = ids;
        }
        return out;
    } catch {
        return EMPTY;
    }
}

export function readRowOrder(): RowOrder {
    if (cache) return cache;
    try {
        cache = parse(window.localStorage.getItem(ROW_ORDER_KEY));
    } catch {
        cache = EMPTY;
    }
    return cache;
}

export function writeRowOrder(next: RowOrder): void {
    cache = next;
    try {
        if (Object.keys(next).length === 0) window.localStorage.removeItem(ROW_ORDER_KEY);
        else window.localStorage.setItem(ROW_ORDER_KEY, JSON.stringify(next));
    } catch {
        // Bộ nhớ bị chặn: vẫn giữ trong phiên hiện tại.
    }
    listeners.forEach((listener) => listener());
}

export function subscribeRowOrder(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent): void => {
        if (event.key !== null && event.key !== ROW_ORDER_KEY) return;
        cache = null;
        listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
}

export const serverRowOrder = (): RowOrder => EMPTY;
