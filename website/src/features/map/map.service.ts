import { AuthApiError, apiRequest } from "@/features/auth/auth.api";
import type { SearchFilters } from "@/features/map/map-url";
import type {
    DatasetVersion,
    MapConfig,
    MapPlace,
    MapPoint,
    MapRoute,
    MapSuggestion,
    MapPlaceKind,
    MapUsage,
    PlaceEvaluation,
    RouteVehicle,
    SavedPlace,
} from "@/features/map/map.types";

function withSignal(signal?: AbortSignal): RequestInit {
    return signal ? { signal } : {};
}

export function getMapConfig(signal?: AbortSignal): Promise<MapConfig> {
    return apiRequest("/map/config", withSignal(signal));
}

/** Cấu hình nền bản đồ cho trang công khai (không cần đăng nhập, không có tìm kiếm). */
export function getPublicMapConfig(signal?: AbortSignal): Promise<MapConfig> {
    return apiRequest("/map/public-config", withSignal(signal));
}

export function searchPlaces(
    text: string,
    focus: MapPoint | null,
    filters: SearchFilters,
    signal?: AbortSignal,
): Promise<MapSuggestion[]> {
    const query = new URLSearchParams({ text, limit: "8" });
    if (focus) {
        query.set("lat", String(focus.lat));
        query.set("lng", String(focus.lng));
    }
    if (filters.cats) query.set("cats", filters.cats);
    if (filters.scope) query.set("scope", filters.scope);
    if (filters.cityId) query.set("cityId", String(filters.cityId));
    if (filters.distId) query.set("distId", String(filters.distId));
    if (filters.wardId) query.set("wardId", String(filters.wardId));
    if (filters.radius) query.set("radius", String(filters.radius));
    return apiRequest(`/map/search?${query.toString()}`, withSignal(signal));
}

export function resolvePlace(refId: string, signal?: AbortSignal): Promise<MapPlace> {
    const query = new URLSearchParams({ refId });
    return apiRequest(`/map/places/resolve?${query.toString()}`, withSignal(signal));
}

export function reverseGeocode(point: MapPoint, signal?: AbortSignal): Promise<MapPlace | null> {
    const query = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
    return apiRequest(`/map/reverse?${query.toString()}`, withSignal(signal));
}

export interface RouteOptions {
    alternatives: boolean;
    avoid: string | null;
    departAt: string | null;
}

export function getRoutes(
    from: MapPoint,
    to: MapPoint,
    vehicle: RouteVehicle,
    options: RouteOptions,
    signal?: AbortSignal,
): Promise<MapRoute[]> {
    const query = new URLSearchParams({
        from: `${from.lat},${from.lng}`,
        to: `${to.lat},${to.lng}`,
        vehicle,
        alternatives: String(options.alternatives),
    });
    if (options.avoid) query.set("avoid", options.avoid);
    if (options.departAt) query.set("time", options.departAt);
    return apiRequest(`/map/route?${query.toString()}`, withSignal(signal));
}

export function getMapUsage(signal?: AbortSignal): Promise<MapUsage> {
    return apiRequest("/admin/map/usage", withSignal(signal));
}

export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

/** Thông điệp tiếng Việt cho người dùng; không lộ chi tiết kỹ thuật. */
export function mapErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof AuthApiError) {
        if (error.status === 429) return "Bạn thao tác hơi nhanh, vui lòng thử lại sau ít giây.";
        if (error.status === 404 || error.status === 422 || error.status === 503) {
            return error.message || fallback;
        }
    }
    return fallback;
}

function pointQuery(point: MapPoint): string {
    return new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) }).toString();
}

export function listSavedPlaces(signal?: AbortSignal): Promise<SavedPlace[]> {
    return apiRequest("/map/saved", withSignal(signal));
}

export function savePlace(input: { lat: number; lng: number; name: string; address: string; kind?: MapPlaceKind }): Promise<SavedPlace> {
    return apiRequest("/map/saved", { method: "POST", body: JSON.stringify(input) });
}

export function removeSavedPlace(id: string): Promise<{ id: string }> {
    return apiRequest(`/map/saved/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Lượt đánh giá gần nhất của chính người dùng tại điểm này (null nếu chưa bấm). Chỉ đọc, không tính phí. */
export function getMyEvaluation(point: MapPoint, signal?: AbortSignal): Promise<{ evaluation: PlaceEvaluation | null; currentDatasetVersion: number }> {
    return apiRequest(`/map/places/evaluation?${pointQuery(point)}`, withSignal(signal));
}

/**
 * Bấm "Đánh giá" / "Đánh giá lại" (lượt tính phí). Nếu lượt gần nhất đã theo phiên bản dữ liệu hiện hành,
 * backend trả lại lượt đó với `charged: false`.
 */
export function runEvaluation(point: MapPoint): Promise<{ evaluation: PlaceEvaluation; charged: boolean }> {
    return apiRequest("/map/places/evaluation", { method: "POST", body: JSON.stringify({ lat: point.lat, lng: point.lng }) });
}

export function listDatasetVersions(signal?: AbortSignal): Promise<DatasetVersion[]> {
    return apiRequest("/admin/map/dataset-versions", withSignal(signal));
}

/** Admin phát hành phiên bản dữ liệu mới (hiện hành + 1). */
export function releaseDatasetVersion(note: string): Promise<DatasetVersion> {
    return apiRequest("/admin/map/dataset-versions", { method: "POST", body: JSON.stringify({ note }) });
}

/** Bỏ qua tiêu chí hoặc đặt điểm tay (score: null = về điểm tự động). Trả về đánh giá đã tính lại. */
export function overrideCriterion(
    point: MapPoint,
    criterionId: string,
    patch: { skipped?: boolean; score?: number | null },
): Promise<PlaceEvaluation> {
    return apiRequest(`/map/places/evaluation/criteria/${encodeURIComponent(criterionId)}`, {
        method: "PUT",
        body: JSON.stringify({ lat: point.lat, lng: point.lng, ...patch }),
    });
}

export function resetCriterion(point: MapPoint, criterionId: string): Promise<PlaceEvaluation> {
    return apiRequest(`/map/places/evaluation/criteria/${encodeURIComponent(criterionId)}?${pointQuery(point)}`, {
        method: "DELETE",
    });
}
