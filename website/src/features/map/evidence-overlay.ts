import { circleToPolygon } from "@/features/map/map.geo";
import type { EvaluatedCriterion, MapPoint, MapRoute, MeasurementCell } from "@/features/map/map.types";

/**
 * Dẫn chứng trực quan của một tiêu chí trên bản đồ (bấm vào dòng tiêu chí trong bảng đánh giá). Mỗi cách đo có một
 * cách thể hiện để người đọc tự kiểm được con số:
 *
 * | Cách đo            | Tiêu chí                                         | Thể hiện                                                    |
 * | ------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
 * | `nearest`          | chợ, hiệu thuốc, siêu thị, UBND, vật tư, công viên, trường, metro, xe buýt | đường đi thật tới chỗ gần nhất + vòng "đạt trọn điểm" |
 * | `travel_time`      | bệnh viện                                        | đường đi xe máy tới chỗ nhanh nhất (phút), ứng viên khác ghi phút |
 * | `anchor`           | nội đô                                           | đường đi xe máy tới Hồ Gươm (phút)                          |
 * | `count`            | quán ăn, cà phê                                  | vòng bán kính đếm + chấm từng quán, đậm dần khi gần         |
 * | `line_nearest`     | đường lớn, ồn giao thông                         | nét đứt vuông góc tới điểm gần nhất trên đường + vòng ngưỡng |
 * | `grid_*`           | dân cư, mảng xanh, độ cao, ngập sông             | tô từng ô 100 m theo giá trị (bản đồ nhiệt), viền bán kính  |
 * | `air_station`      | không khí                                        | nét đứt tới trạm quan trắc, nhãn PM2.5                      |
 *
 * Tiêu chí chưa có số đo (chưa có dữ liệu, cần AI chưa làm) không có dẫn chứng.
 */

export type EvidenceTone = "green" | "red" | "blue" | "amber" | "violet" | "slate";

export interface EvidenceArea {
    ring: Array<[number, number]>;
    color: string;
    opacity: number;
    /** Viền nét đứt (vòng ngưỡng) hay ô tô màu (không viền). */
    outline: boolean;
}

export interface EvidenceLine {
    coordinates: Array<[number, number]>;
    /** route: đường đi thật; connector: nét đứt nối thẳng. */
    style: "route" | "connector";
    color: string;
}

export interface EvidencePoint {
    lat: number;
    lng: number;
    /** target: đối tượng chính (có nhãn); other: đối tượng phụ (chấm nhỏ). */
    emphasis: "target" | "other";
    label: string | null;
    color: string;
    /** 0–1: độ đậm chấm phụ (trọng số khoảng cách). */
    weight: number;
}

export interface EvidenceOverlay {
    criterionId: string;
    origin: MapPoint;
    areas: EvidenceArea[];
    lines: EvidenceLine[];
    points: EvidencePoint[];
    /** Câu giải thích hiện trên bản đồ. */
    caption: string;
    /** Chú giải thang màu cho ô lưới: [màu, nhãn]. */
    legend: Array<[string, string]> | null;
    /** [minLng, minLat, maxLng, maxLat] để đưa cả dẫn chứng vào khung nhìn. */
    bbox: [number, number, number, number];
}

export interface EvidencePlan {
    overlay: EvidenceOverlay;
    /** Cần lấy đường đi thật tới điểm này (Vietmap Route) rồi gọi `withRoute`. */
    routeTo: MapPoint | null;
}

const COLORS: Record<EvidenceTone, string> = {
    green: "#026a4e",
    red: "#c0392b",
    blue: "#1d6fd1",
    amber: "#b7791f",
    violet: "#6d4ed8",
    slate: "#4b5563",
};

/** Thang màu tuần tự một sắc độ (nhạt → đậm) cho ô lưới. */
const SEQUENTIAL: Record<"people" | "green" | "flood" | "elevation", readonly string[]> = {
    people: ["#f3e8ff", "#d8b4fe", "#a855f7", "#7e22ce", "#4c1d95"],
    green: ["#ecfdf3", "#a7e3c4", "#4fbf8a", "#16884f", "#065f3b"],
    flood: ["#e0f2fe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"],
    elevation: ["#fef3c7", "#fcd34d", "#d97706", "#92400e", "#451a03"],
};

function base(item: EvaluatedCriterion): string {
    return (item.method ?? "").split("@")[0];
}

function formatMeters(meters: number): string {
    if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
    return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/** "Trường học" → "trường học"; giữ nguyên chữ viết tắt ("UBND"). */
function lowerFirst(label: string): string {
    const word = label.split(" ")[0];
    return word === word.toUpperCase() ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

function formatNumber(value: number, digits = 0): string {
    return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function ringOf(center: MapPoint, radiusM: number): Array<[number, number]> {
    return circleToPolygon(center, radiusM, 72).features[0].geometry.coordinates[0] as Array<[number, number]>;
}

/** Ô vuông `sizeM` quanh tâm (đủ chính xác để vẽ ô 100 m). */
export function cellRing(cell: Pick<MeasurementCell, "lat" | "lng">, sizeM: number): Array<[number, number]> {
    const half = sizeM / 2;
    const dLat = half / 111320;
    const dLng = half / (111320 * Math.cos((cell.lat * Math.PI) / 180));
    return [
        [cell.lng - dLng, cell.lat - dLat],
        [cell.lng + dLng, cell.lat - dLat],
        [cell.lng + dLng, cell.lat + dLat],
        [cell.lng - dLng, cell.lat + dLat],
        [cell.lng - dLng, cell.lat - dLat],
    ];
}

/** Chia giá trị thành 5 bậc đều giữa min và max (bậc của từng ô). */
export function classify(values: readonly number[], steps = 5): { index: (value: number) => number; breaks: number[] } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const breaks = Array.from({ length: steps + 1 }, (_, i) => min + (span * i) / steps);
    return {
        index: (value) => (span <= 0 ? Math.floor(steps / 2) : Math.min(steps - 1, Math.floor(((value - min) / span) * steps))),
        breaks,
    };
}

function bboxOf(coordinates: ReadonlyArray<readonly [number, number]>): [number, number, number, number] {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of coordinates) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
    }
    return [minLng, minLat, maxLng, maxLat];
}

function finish(overlay: Omit<EvidenceOverlay, "bbox">): EvidenceOverlay {
    const coordinates: Array<[number, number]> = [
        [overlay.origin.lng, overlay.origin.lat],
        ...overlay.areas.flatMap((area) => area.ring),
        ...overlay.lines.flatMap((line) => line.coordinates),
        ...overlay.points.map((point): [number, number] => [point.lng, point.lat]),
    ];
    return { ...overlay, bbox: bboxOf(coordinates) };
}

function gridPalette(item: EvaluatedCriterion): readonly string[] {
    if (item.id === "mang-xanh") return SEQUENTIAL.green;
    if (item.id === "ngap-song") return SEQUENTIAL.flood;
    if (item.id === "do-cao") return SEQUENTIAL.elevation;
    return SEQUENTIAL.people;
}

function gridUnit(item: EvaluatedCriterion): string {
    if (item.id === "mang-xanh") return "%";
    if (item.id === "ngap-song" || item.id === "do-cao") return " m";
    return " người";
}

/** Tiêu chí này có dẫn chứng để vẽ không. */
export function hasEvidence(item: EvaluatedCriterion): boolean {
    if (item.status !== "ok" && item.status !== "fallback") return false;
    const method = base(item);
    if (method.startsWith("grid_")) return item.cells.length > 0;
    if (method === "count") return true;
    if (method === "anchor") return item.evidence.length > 0;
    return item.evidence.length > 0;
}

/**
 * Kế hoạch vẽ dẫn chứng của tiêu chí tại `origin`. Trả null nếu tiêu chí chưa có gì để vẽ. Với tiêu chí cần
 * đường đi thật, `routeTo` cho biết điểm đích; trong lúc chờ (hoặc khi lấy đường lỗi) lớp phủ đã có nét đứt nối
 * thẳng làm phương án hiển thị.
 */
export function planEvidence(item: EvaluatedCriterion, origin: MapPoint): EvidencePlan | null {
    if (!hasEvidence(item)) return null;
    const method = base(item);
    const [first, ...rest] = item.evidence;
    const straight = (to: MapPoint, color: string): EvidenceLine => ({
        coordinates: [
            [origin.lng, origin.lat],
            [to.lng, to.lat],
        ],
        style: "connector",
        color,
    });

    if (method === "nearest" || method === "travel_time" || method === "anchor") {
        const color = method === "nearest" ? COLORS.green : COLORS.blue;
        const minutes = first.minutes !== undefined ? ` · ${formatNumber(first.minutes)} phút xe máy` : "";
        const areas: EvidenceArea[] =
            item.radiusM && method === "nearest"
                ? [{ ring: ringOf(origin, item.radiusM), color: COLORS.green, opacity: 0.06, outline: true }]
                : [];
        const points: EvidencePoint[] = [
            { lat: first.lat, lng: first.lng, emphasis: "target", label: `${first.name} · ${formatMeters(first.distanceM)}${minutes}`, color, weight: 1 },
            ...rest.map((other) => ({
                lat: other.lat,
                lng: other.lng,
                emphasis: "other" as const,
                label: other.minutes !== undefined ? `${other.name} · ${formatNumber(other.minutes)} phút` : other.name,
                color: COLORS.slate,
                weight: 0.6,
            })),
        ];
        const ring = item.radiusM && method === "nearest" ? ` Vòng tròn: trong ${formatMeters(item.radiusM)} đạt trọn điểm.` : "";
        const caption =
            method === "nearest"
                ? `Đường đi tới ${lowerFirst(item.label)} gần nhất: ${first.name}, cách ${formatMeters(first.distanceM)} đường chim bay.${ring}`
                : `${item.detail}.${rest.length > 0 ? " Chấm xám: các lựa chọn khác và thời gian đi." : ""}`;
        return {
            overlay: finish({ criterionId: item.id, origin, areas, lines: [straight(first, color)], points, caption, legend: null }),
            routeTo: { lat: first.lat, lng: first.lng },
        };
    }

    if (method === "count") {
        const radius = item.radiusM ?? 500;
        const points: EvidencePoint[] = item.evidence.map((point) => ({
            lat: point.lat,
            lng: point.lng,
            emphasis: "other",
            label: `${point.name} · ${formatMeters(point.distanceM)}`,
            color: COLORS.amber,
            // Trừ hao tuyến tính theo khoảng cách như khi chấm điểm: gần thì đậm.
            weight: Math.max(0.25, 1 - point.distanceM / radius),
        }));
        return {
            overlay: finish({
                criterionId: item.id,
                origin,
                areas: [{ ring: ringOf(origin, radius), color: COLORS.amber, opacity: 0.08, outline: true }],
                lines: [],
                points,
                caption: `${item.detail}. Chấm càng đậm càng gần, góp càng nhiều điểm.`,
                legend: null,
            }),
            routeTo: null,
        };
    }

    if (method === "line_nearest") {
        const noise = item.id === "on-giao-thong";
        const color = noise ? COLORS.red : COLORS.slate;
        const areas: EvidenceArea[] = item.radiusM ? [{ ring: ringOf(origin, item.radiusM), color, opacity: 0.06, outline: true }] : [];
        return {
            overlay: finish({
                criterionId: item.id,
                origin,
                areas,
                lines: [straight(first, color)],
                points: [{ lat: first.lat, lng: first.lng, emphasis: "target", label: `${first.name} · ${formatMeters(first.distanceM)}`, color, weight: 1 }],
                caption: noise
                    ? `Đường trục gần nhất cách ${formatMeters(first.distanceM)}. Ngoài vòng ${formatMeters(item.radiusM ?? 600)} được coi là yên tĩnh.`
                    : `Điểm gần nhất trên đường lớn: ${first.name}, cách ${formatMeters(first.distanceM)}.`,
                legend: null,
            }),
            routeTo: null,
        };
    }

    if (method.startsWith("grid_")) {
        const palette = gridPalette(item);
        const unit = gridUnit(item);
        const values = item.cells.map((cell) => cell.value);
        const scale = classify(values, palette.length);
        const size = item.cellM ?? 100;
        const areas: EvidenceArea[] = item.cells.map((cell) => ({
            ring: cellRing(cell, size),
            color: palette[scale.index(cell.value)],
            // Ngập sông: ô không ngập (0) để trong suốt hơn.
            opacity: item.id === "ngap-song" && cell.value <= 0 ? 0.15 : 0.55,
            outline: false,
        }));
        if (item.radiusM) areas.push({ ring: ringOf(origin, item.radiusM), color: COLORS.slate, opacity: 0, outline: true });
        const legend = palette.map((color, index): [string, string] => [
            color,
            `${formatNumber(scale.breaks[index], 1)}–${formatNumber(scale.breaks[index + 1], 1)}${unit}`,
        ]);
        const what =
            item.id === "mat-do-dan-cu"
                ? "Dân số ước tính từng ô 100 m"
                : item.id === "mang-xanh"
                  ? "Tỷ lệ diện tích có cây từng ô 100 m"
                  : item.id === "do-cao"
                    ? "Cao độ mặt đất từng ô 100 m"
                    : "Độ sâu ngập mô hình (chu kỳ 100 năm) của ô chứa địa điểm";
        return {
            overlay: finish({
                criterionId: item.id,
                origin,
                areas,
                lines: [],
                points: [],
                caption: `${what}${item.radiusM ? ` trong ${formatMeters(item.radiusM)}` : ""}. ${item.detail}.`,
                legend: values.length > 1 ? legend : null,
            }),
            routeTo: null,
        };
    }

    if (method === "air_station") {
        return {
            overlay: finish({
                criterionId: item.id,
                origin,
                areas: [],
                lines: [straight(first, COLORS.violet)],
                points: [
                    {
                        lat: first.lat,
                        lng: first.lng,
                        emphasis: "target",
                        label: `${first.name} · PM2.5 ${item.value !== null ? formatNumber(item.value) : "?"} µg/m³`,
                        color: COLORS.violet,
                        weight: 1,
                    },
                ],
                caption: `Trạm quan trắc gần nhất cách ${formatMeters(first.distanceM)}. ${item.detail}.`,
                legend: null,
            }),
            routeTo: null,
        };
    }
    return null;
}

/** Thay nét đứt bằng đường đi thật khi đã lấy được tuyến. */
export function withRoute(overlay: EvidenceOverlay, route: MapRoute): EvidenceOverlay {
    const color = overlay.lines[0]?.color ?? COLORS.green;
    const minutes = Math.round(route.durationS / 60);
    const caption = overlay.caption.includes("phút")
        ? overlay.caption
        : `${overlay.caption} Theo đường đi: ${formatMeters(route.distanceM)}, khoảng ${minutes} phút xe máy.`;
    return finish({
        ...overlay,
        lines: [{ coordinates: route.geometry, style: "route", color }, ...overlay.lines.slice(1)],
        caption,
    });
}
