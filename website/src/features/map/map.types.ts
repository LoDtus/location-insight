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
    /** Địa điểm chuẩn hóa: các cú bấm lệch vài mét / cùng địa chỉ gom về một. */
    placeId: string;
    lat: number;
    lng: number;
    name: string;
    address: string;
    kind: MapPlaceKind | null;
    /** Tên gợi nhớ người dùng tự đặt; null = dùng `name`. */
    label: string | null;
    /** Ghi chú riêng (nhiều dòng). */
    note: string;
    /** Đang nằm trong danh sách so sánh. */
    compared: boolean;
    createdAt: string;
    /** Lượt đánh giá gần nhất của chính người dùng; null nếu chưa đánh giá. */
    evaluation: EvaluationSummary | null;
}

/** Một cột của bảng so sánh: đánh giá đầy đủ từ lượt gần nhất của chính người dùng (null nếu chưa đánh giá). */
export interface CompareItem extends Omit<SavedPlace, "evaluation"> {
    evaluation: PlaceEvaluation | null;
}

/** Một kết quả khi tìm theo loại hình ("ngân hàng"): được ghim lên bản đồ cùng các kết quả khác. */
export interface PinResult extends MapPlace {
    refId: string;
}

export interface EvaluationSummary {
    overall: number | null;
    rating: string;
    datasetVersion: number;
    outdated: boolean;
    evaluatedAt: string;
}

export type CriterionGroup = "walk" | "move" | "health" | "env" | "ai";

/**
 * ok: đo thật · fallback: đo dự phòng (ví dụ khoảng cách thay thời gian đi) · no_data: chưa có dữ liệu ·
 * unavailable: nguồn chưa cấu hình hoặc lỗi · not_implemented: tiêu chí cần AI chưa làm, điểm là số minh họa.
 */
export type MeasurementStatus = "ok" | "fallback" | "no_data" | "unavailable" | "not_implemented";

export type Confidence = "high" | "medium" | "low";

/** Đối tượng làm dẫn chứng của một tiêu chí (điểm gần nhất, đường gần nhất…). */
export interface MeasurementEvidence {
    name: string;
    lat: number;
    lng: number;
    distanceM: number;
    minutes?: number;
}

export interface EvaluatedCriterion {
    /** Mã tiêu chí cố định (xem criteria-icons.ts). */
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
    /** Trọng số đang dùng (0–5): của người dùng nếu đã đặt, không thì mặc định. */
    weight: number;
    defaultWeight: number;
    status: MeasurementStatus;
    confidence: Confidence;
    /** Có góp vào điểm tổng không. */
    counted: boolean;
    /** Vì sao chưa đo được, hoặc giới hạn đã biết. */
    note: string | null;
    blockingHit: boolean;
    evidence: MeasurementEvidence[];
}

export interface EvaluationBlocking {
    criterionId: string;
    label: string;
    message: string;
    cap: number;
}

export interface CriterionWeight {
    id: CriterionId;
    label: string;
    group: CriterionGroup;
    groupLabel: string;
    defaultWeight: number;
    weight: number;
    /** Đã đổi khỏi mặc định. */
    custom: boolean;
}

export interface WeightsView {
    min: number;
    max: number;
    criteria: CriterionWeight[];
    changed: number;
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
    /** Có mặt nhưng không vào điểm tổng: chưa có dữ liệu, nguồn lỗi, dữ liệu mỏng, hoặc tiêu chí AI chưa làm. */
    pending: EvaluatedCriterion[];
    skipped: EvaluatedCriterion[];
    criteriaCount: number;
    /** Tỷ lệ (0–1, theo trọng số) tiêu chí đo được; dưới 0,6 thì điểm tổng chỉ để tham khảo. */
    coverage: number;
    /** Điều kiện chặn đang giới hạn điểm tổng. */
    blocking: EvaluationBlocking[];
    /** Địa điểm chuẩn hóa mà điểm bấm được gom vào. */
    placeId: string;
    /** fresh: lượt này đo mới; shared: nhận bản phân tích mới nhất đã có của địa điểm. */
    source: "fresh" | "shared";
    /** Lúc bản phân tích được tạo (lần đo). */
    analyzedAt: string;
    /** Phiên bản dữ liệu của bản phân tích này. */
    datasetVersion: number;
    /** Phiên bản dữ liệu hiện hành của hệ thống. */
    currentDatasetVersion: number;
    /** Đã có phiên bản dữ liệu mới hơn: có thể "Đánh giá lại". */
    outdated: boolean;
    evaluatedAt: string;
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
