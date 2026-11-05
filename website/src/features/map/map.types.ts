import type { CriterionId } from "@/features/map/criteria-icons";

export interface MapSuggestion {
    refId: string;
    name: string;
    address: string;
    addressOld: string | null;
    display: string;
    distanceKm: number | null;
}

export interface MapPlace {
    lat: number;
    lng: number;
    name: string;
    address: string;
    addressOld: string | null;
    display: string;
    /** Mét từ điểm bấm tới địa điểm tìm được (chỉ có khi lấy từ reverse). */
    distanceM?: number | null;
    /** Loại địa điểm theo Vietmap (suy từ ref_id). */
    kind?: MapPlaceKind;
    /** Mã nhóm POI của Vietmap. */
    categories?: string[];
}

export type MapPlaceKind = "poi" | "address" | "street" | "ward" | "district" | "city" | "village" | "unknown";

export interface SavedPlace {
    id: string;
    placeKey: string;
    lat: number;
    lng: number;
    name: string;
    address: string;
    kind: MapPlaceKind | null;
    createdAt: string;
}

export type CriterionGroup = "walk" | "move" | "health" | "env";

export interface EvaluatedCriterion {
    /** Một trong 19 mã cố định (xem criteria-icons.ts). */
    id: CriterionId;
    label: string;
    group: CriterionGroup;
    groupLabel: string;
    /** Kết luận ngắn: Gần / Vừa / Xa… */
    verdict: string;
    /** Số đo: "Cách bệnh viện gần nhất 1,4 km". */
    detail: string;
    source: string;
    score: number;
    autoScore: number;
    manual: boolean;
    skipped: boolean;
}

export interface PlaceEvaluation {
    placeKey: string;
    lat: number;
    lng: number;
    sample: boolean;
    overall: number | null;
    rating: string;
    summary: string;
    strengths: { points: number; items: EvaluatedCriterion[] };
    weaknesses: { points: number; items: EvaluatedCriterion[] };
    skipped: EvaluatedCriterion[];
    criteriaCount: number;
}

export type Congestion = "low" | "moderate" | "heavy" | "severe" | "unknown";

export interface MapRouteStep {
    text: string;
    distanceM: number;
    durationS: number;
    sign: number;
    street: string;
}

export interface MapRoute {
    distanceM: number;
    durationS: number;
    /** [minLng, minLat, maxLng, maxLat] */
    bbox: [number, number, number, number];
    /** [lng, lat] */
    geometry: Array<[number, number]>;
    steps: MapRouteStep[];
    congestion: Congestion[] | null;
}

export type MapStyleId = "tm" | "lm" | "dm" | "hm";
export type RouteVehicle = "car" | "motorcycle";

export interface MapConfig {
    styles: Array<{ id: MapStyleId; url: string }>;
    trafficStyleUrl: string | null;
    /** [lng, lat] */
    center: [number, number];
    zoom: number;
    /** [minLng, minLat, maxLng, maxLat] */
    maxBounds: [number, number, number, number];
    searchEnabled: boolean;
    tilesEnabled: boolean;
}

export interface MapUsage {
    date: string;
    budget: number;
    upstream: Record<string, number>;
    cacheHits: Record<string, number>;
}

/** Điểm trên bản đồ (REST dùng lat/lng; GL JS dùng [lng, lat] — đổi ở biên). */
export interface MapPoint {
    lat: number;
    lng: number;
}

export interface Waypoint extends MapPoint {
    label: string;
}
