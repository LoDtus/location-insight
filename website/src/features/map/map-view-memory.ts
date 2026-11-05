import { inVietnam, ZOOM_RANGE } from "@/features/map/map-url";
import type { MapPoint } from "@/features/map/map.types";

/** Khung nhìn bản đồ được nhớ trong phiên trình duyệt (tâm + mức zoom). */
export interface SavedMapView {
    lat: number;
    lng: number;
    zoom: number;
}

/** Khóa sessionStorage; xóa khi đăng xuất. */
export const MAP_VIEW_STORAGE_KEY = "li:map-view";

/** Hồ Hoàn Kiếm — khung nhìn mặc định khi không lấy được vị trí người dùng. */
export const DEFAULT_MAP_CENTER: MapPoint = { lat: 21.0287, lng: 105.8524 };
export const DEFAULT_MAP_ZOOM = 15;

/** Storage tối thiểu cần dùng — để test truyền bản giả. */
type ViewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): ViewStorage | null {
    try {
        return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
        // Trình duyệt chặn storage (chế độ riêng tư, chặn cookie…).
        return null;
    }
}

/** Kiểm tra dữ liệu đọc từ storage: chỉ nhận số hữu hạn, trong Việt Nam, zoom hợp lệ. */
export function parseSavedMapView(raw: string | null): SavedMapView | null {
    if (!raw) return null;
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof value !== "object" || value === null) return null;
    const { lat, lng, zoom } = value as Record<string, unknown>;
    if (typeof lat !== "number" || typeof lng !== "number" || typeof zoom !== "number") return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
    if (!inVietnam(lat, lng) || zoom < ZOOM_RANGE.min || zoom > ZOOM_RANGE.max) return null;
    return { lat, lng, zoom };
}

export function readSavedMapView(storage: ViewStorage | null = sessionStore()): SavedMapView | null {
    try {
        return parseSavedMapView(storage?.getItem(MAP_VIEW_STORAGE_KEY) ?? null);
    } catch {
        return null;
    }
}

export function writeSavedMapView(view: SavedMapView, storage: ViewStorage | null = sessionStore()): void {
    const valid = parseSavedMapView(JSON.stringify(view));
    if (!valid || !storage) return;
    try {
        storage.setItem(
            MAP_VIEW_STORAGE_KEY,
            JSON.stringify({
                lat: Number(valid.lat.toFixed(6)),
                lng: Number(valid.lng.toFixed(6)),
                zoom: Number(valid.zoom.toFixed(2)),
            }),
        );
    } catch {
        // Hết dung lượng hoặc bị chặn: bỏ qua, chỉ mất tính năng nhớ khung nhìn.
    }
}

export function clearSavedMapView(storage: ViewStorage | null = sessionStore()): void {
    try {
        storage?.removeItem(MAP_VIEW_STORAGE_KEY);
    } catch {
        // Bị chặn: không có gì để xóa.
    }
}
