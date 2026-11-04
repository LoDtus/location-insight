import type { Congestion, MapPoint, MapRoute } from "@/features/map/map.types";

const EARTH_CIRCUMFERENCE_M = 40075016.686;
const TILE_SIZE_PX = 512;

/** Mét trên mỗi pixel CSS ở zoom GL (tile 512 px) và vĩ độ cho trước. */
export function metersPerPixel(zoom: number, latitude: number): number {
    return (
        (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) /
        (TILE_SIZE_PX * Math.pow(2, zoom))
    );
}

const NICE_STEPS_M = [
    1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
    100000, 200000, 500000, 1000000,
];

/** Chọn mốc "đẹp" lớn nhất không vượt quá `maxMeters`; trả về cả độ dài px tương ứng. */
export function niceScale(
    zoom: number,
    latitude: number,
    maxPx = 96,
): { meters: number; px: number; label: string } {
    const perPx = metersPerPixel(zoom, latitude);
    const maxMeters = perPx * maxPx;
    let meters = NICE_STEPS_M[0];
    for (const step of NICE_STEPS_M) {
        if (step <= maxMeters) meters = step;
    }
    return {
        meters,
        px: Math.round(meters / perPx),
        label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
    };
}

export function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters / 10) * 10} m`.replace(/^0 m$/, "< 10 m");
    const km = meters / 1000;
    return `${km >= 100 ? Math.round(km) : km.toFixed(1).replace(".", ",")} km`;
}

export function formatDuration(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
}

export function formatCoordinates(point: MapPoint): string {
    return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

export const CONGESTION_COLORS: Record<Congestion, string> = {
    low: "#1a9850",
    moderate: "#f2b705",
    heavy: "#f46d43",
    severe: "#c0392b",
    unknown: "#2563eb",
};

export interface RouteFeatureCollection {
    type: "FeatureCollection";
    features: Array<{
        type: "Feature";
        properties: { level: Congestion };
        geometry: { type: "LineString"; coordinates: Array<[number, number]> };
    }>;
}

/** Gộp các đoạn liên tiếp cùng mức tắc thành một LineString để tô màu theo dữ liệu. */
export function routeToFeatures(route: MapRoute): RouteFeatureCollection {
    const features: RouteFeatureCollection["features"] = [];
    const { geometry, congestion } = route;
    if (!congestion || congestion.length !== geometry.length - 1) {
        features.push({
            type: "Feature",
            properties: { level: "unknown" },
            geometry: { type: "LineString", coordinates: geometry },
        });
        return { type: "FeatureCollection", features };
    }
    let start = 0;
    for (let index = 1; index <= congestion.length; index += 1) {
        if (index === congestion.length || congestion[index] !== congestion[start]) {
            features.push({
                type: "Feature",
                properties: { level: congestion[start] },
                geometry: { type: "LineString", coordinates: geometry.slice(start, index + 1) },
            });
            start = index;
        }
    }
    return { type: "FeatureCollection", features };
}

export function emptyFeatures(): RouteFeatureCollection {
    return { type: "FeatureCollection", features: [] };
}

/** Nhãn hướng rẽ từ `sign` của Route v4 (mũi tên chữ, không chỉ dựa vào màu). */
export function signLabel(sign: number): string {
    switch (sign) {
        case -3:
            return "↰";
        case -2:
            return "←";
        case -1:
            return "↖";
        case 0:
            return "↑";
        case 1:
            return "↗";
        case 2:
            return "→";
        case 3:
            return "↱";
        case 4:
            return "⚑";
        case 5:
            return "◉";
        case 6:
            return "⟳";
        default:
            return "•";
    }
}

/** Địa điểm cách điểm bấm không quá ngần này mét mới coi là "chính xác tại đó". */
export const PRECISE_PLACE_M = 10;
/** Mức zoom khi mở một ghim. */
export const PIN_ZOOM = 16;
export const NEARBY_RADIUS = { min: 100, max: 5000, step: 100, initial: 500 } as const;

const EARTH_RADIUS_M = 6371008.8;

/** Đa giác xấp xỉ hình tròn bán kính `radiusM` quanh `center` (GeoJSON, [lng, lat]). */
export function circleToPolygon(center: MapPoint, radiusM: number, steps = 64): CircleFeatureCollection {
    const latRad = (center.lat * Math.PI) / 180;
    const angular = radiusM / EARTH_RADIUS_M;
    const ring: Array<[number, number]> = [];
    for (let index = 0; index <= steps; index += 1) {
        const bearing = (index / steps) * 2 * Math.PI;
        const dLat = angular * Math.cos(bearing);
        const dLng = (angular * Math.sin(bearing)) / Math.cos(latRad);
        ring.push([center.lng + (dLng * 180) / Math.PI, center.lat + (dLat * 180) / Math.PI]);
    }
    return {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
    };
}

export interface CircleFeatureCollection {
    type: "FeatureCollection";
    features: Array<{
        type: "Feature";
        properties: Record<string, never>;
        geometry: { type: "Polygon"; coordinates: Array<Array<[number, number]>> };
    }>;
}

/** Hộp bao [minLng, minLat, maxLng, maxLat] của hình tròn. */
export function circleBounds(center: MapPoint, radiusM: number): [number, number, number, number] {
    const ring = circleToPolygon(center, radiusM, 8).features[0].geometry.coordinates[0];
    const lngs = ring.map((point) => point[0]);
    const lats = ring.map((point) => point[1]);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/** Link mở bản đồ đúng điểm: tâm, mức zoom mặc định của ghim và ghim, đều 6 chữ số thập phân (~0,1 m). */
export function placeLink(origin: string, pathname: string, point: MapPoint): string {
    const at = `${Number(point.lat.toFixed(6))},${Number(point.lng.toFixed(6))}`;
    return `${origin}${pathname}?c=${at}&z=${PIN_ZOOM}&pin=${at}`;
}
