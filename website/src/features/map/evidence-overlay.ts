import { circleToPolygon } from "@/features/map/map.geo";
import type { EvaluatedCriterion, MapPoint, MapRoute, MeasurementCell, MeasurementEvidence } from "@/features/map/map.types";

/**
 * Dẫn chứng trực quan của một tiêu chí trên bản đồ (bấm vào dòng tiêu chí trong bảng đánh giá).
 *
 * Quy tắc chung: tối đa 3 ghim có nhãn, đánh số ①②③ theo độ gần; chỉ một tuyến đường mỗi lúc (mặc định tới ①,
 * bấm ghim khác thì đổi tuyến); số phút của các lựa chọn đã có sẵn trong kết quả đo (một lượt Vietmap Matrix lúc
 * đánh giá), chỉ tuyến đường mới gọi Vietmap Route.
 *
 * | Tiêu chí                                   | Thể hiện                                                         |
 * | ------------------------------------------ | ---------------------------------------------------------------- |
 * | Chợ, siêu thị (3), công viên, metro (2), UBND, vật tư (1) | ghim đánh số + tuyến tới lựa chọn đang chọn + vòng "đạt trọn điểm" |
 * | Trường học                                 | mầm non gần nhất + 2 trường phổ thông, ghim ghi cấp, tuyến       |
 * | Hiệu thuốc (3), xe buýt (3)                 | chỉ ghim và vòng ngưỡng (gần, dày; tuyến không thêm thông tin)   |
 * | Bệnh viện (3)                               | ghim kèm số phút, tuyến tới lựa chọn đang chọn                   |
 * | Nội đô                                      | tuyến tới Hồ Gươm + vòng 3/10/20 km                              |
 * | Quán ăn                                     | vòng 500 m + chấm từng quán, đậm dần khi gần                     |
 * | Đường lớn                                   | tô đoạn đường lớn gần nhất + nét nối vuông góc                   |
 * | Ồn giao thông                               | tô các đường trục trong 600 m + vùng ồn 80 m / 300 m             |
 * | Dân cư, mảng xanh, ngập sông                | tô từng ô 100 m theo 5 bậc                                       |
 * | Độ cao tương đối                            | tô ô theo chênh so với ô chứa địa điểm (thấp hơn xanh, cao hơn nâu) |
 * | Không khí                                   | 2 trạm gần nhất kèm PM2.5                                        |
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
    /** false: không tính vào khung nhìn (vòng 20 km của nội đô). */
    fit?: boolean;
}

export interface EvidenceLine {
    coordinates: Array<[number, number]>;
    /** route: đường đi thật; connector: nét đứt nối thẳng; road: tô hình dạng đường làm dẫn chứng. */
    style: "route" | "connector" | "road";
    color: string;
    /** Tuyến đang chọn: nét dày, nằm trên cùng; tuyến khác mảnh và nhạt hơn. */
    emphasis?: "primary" | "secondary";
}

export interface EvidencePoint {
    lat: number;
    lng: number;
    /** target: lựa chọn đang chọn; other: lựa chọn khác hoặc chấm phụ. */
    emphasis: "target" | "other";
    label: string | null;
    color: string;
    /** 0–1: độ đậm chấm phụ (trọng số khoảng cách). */
    weight: number;
    /** Thứ tự lựa chọn (0 = gần nhất) khi ghim bấm được để đổi tuyến; null với chấm phụ. */
    choice: number | null;
}

export interface EvidenceOverlay {
    criterionId: string;
    origin: MapPoint;
    areas: EvidenceArea[];
    lines: EvidenceLine[];
    points: EvidencePoint[];
    /** Câu giải thích hiện trên bản đồ. */
    caption: string;
    /** Chú giải màu: [màu, nhãn]. */
    legend: Array<[string, string]> | null;
    /** [minLng, minLat, maxLng, maxLat] để đưa dẫn chứng vào khung nhìn. */
    bbox: [number, number, number, number];
    /** Lựa chọn đang có tuyến (0 = gần nhất). */
    selected: number;
}

export interface EvidencePlan {
    overlay: EvidenceOverlay;
    /** Các đích cần lấy đường đi thật (Vietmap Route); có tuyến rồi thì gọi lại `planEvidence` kèm `routes`. */
    routeTargets: Array<{ choice: number; point: MapPoint }>;
}

/** Tuyến đã lấy được theo thứ tự lựa chọn (0 = gần nhất). */
export type EvidenceRoutes = Readonly<Record<number, MapRoute>>;

/** Màu theo lựa chọn ①②③ (đi cùng số trên ghim, không phân biệt chỉ bằng màu). */
const CHOICE_COLORS = ["#026a4e", "#1d6fd1", "#b45309", "#7c3aed", "#be185d"] as const;

const COLORS: Record<EvidenceTone, string> = {
    green: "#026a4e",
    red: "#c0392b",
    blue: "#1d6fd1",
    amber: "#b7791f",
    violet: "#6d4ed8",
    slate: "#4b5563",
};

/** Thang màu tuần tự một sắc độ (nhạt → đậm) cho ô lưới. */
const SEQUENTIAL: Record<"people" | "green" | "flood", readonly string[]> = {
    people: ["#f3e8ff", "#d8b4fe", "#a855f7", "#7e22ce", "#4c1d95"],
    green: ["#ecfdf3", "#a7e3c4", "#4fbf8a", "#16884f", "#065f3b"],
    flood: ["#e0f2fe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"],
};

/** Thang hai chiều cho độ cao tương đối: thấp hơn (xanh) – ngang (trung tính) – cao hơn (nâu). */
const DIVERGING_ELEVATION: ReadonlyArray<{ max: number; color: string; label: string }> = [
    { max: -1.5, color: "#1d4ed8", label: "thấp hơn > 1,5 m" },
    { max: -0.5, color: "#93c5fd", label: "thấp hơn 0,5–1,5 m" },
    { max: 0.5, color: "#e5e7eb", label: "ngang (±0,5 m)" },
    { max: 1.5, color: "#d6a76c", label: "cao hơn 0,5–1,5 m" },
    { max: Infinity, color: "#8a5a1f", label: "cao hơn > 1,5 m" },
];

/** Vòng đồng tâm của tiêu chí nội đô (mét). */
const INNER_RINGS_M = [3000, 10000, 20000] as const;

/** Tiêu chí điểm có tuyến đường tới lựa chọn đang chọn; còn lại (hiệu thuốc, xe buýt) chỉ ghim. */
const ROUTED = new Set(["cho", "sieu-thi", "ubnd", "vat-tu", "cong-vien", "truong-hoc", "metro", "benh-vien", "noi-do"]);

const MARKS = ["①", "②", "③", "④", "⑤"];

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
        ...overlay.areas.filter((area) => area.fit !== false).flatMap((area) => area.ring),
        ...overlay.lines.flatMap((line) => line.coordinates),
        ...overlay.points.map((point): [number, number] => [point.lng, point.lat]),
    ];
    return { ...overlay, bbox: bboxOf(coordinates) };
}

function gridPalette(item: EvaluatedCriterion): readonly string[] {
    if (item.id === "mang-xanh") return SEQUENTIAL.green;
    if (item.id === "ngap-song") return SEQUENTIAL.flood;
    return SEQUENTIAL.people;
}

function gridUnit(item: EvaluatedCriterion): string {
    if (item.id === "mang-xanh") return "%";
    if (item.id === "ngap-song") return " m";
    return " người";
}

/** Tiêu chí này có dẫn chứng để vẽ không. */
export function hasEvidence(item: EvaluatedCriterion): boolean {
    if (item.status !== "ok" && item.status !== "fallback") return false;
    const method = base(item);
    if (method.startsWith("grid_")) return item.cells.length > 0;
    if (method === "count") return true;
    if (method === "line_nearest") return item.evidence.length > 0 || item.paths.length > 0;
    return item.evidence.length > 0;
}

/** Nhãn một lựa chọn: "① Mầm non · Hoa Sen · 250 m · 2 phút". */
function choiceLabel(item: EvaluatedCriterion, option: MeasurementEvidence, index: number, count: number): string {
    const mark = count > 1 ? `${MARKS[index] ?? `${index + 1}.`} ` : "";
    const group = option.group ? `${option.group} · ` : "";
    const minutes = option.minutes !== undefined ? ` · ${formatNumber(option.minutes)} phút` : "";
    const reading = base(item) === "air_station" && option.value !== undefined ? ` · PM2.5 ${formatNumber(option.value)} µg/m³` : "";
    return `${mark}${group}${option.name} · ${formatMeters(option.distanceM)}${minutes}${reading}`;
}

/** Câu so sánh lựa chọn đang chọn với lựa chọn gần nhất. */
function comparison(options: readonly MeasurementEvidence[], selected: number): string {
    if (selected === 0 || !options[selected]) return "";
    const chosen = options[selected];
    const first = options[0];
    const farther = chosen.distanceM - first.distanceM;
    const gap = chosen.minutes !== undefined && first.minutes !== undefined ? chosen.minutes - first.minutes : null;
    const minutes =
        gap === null
            ? ""
            : Math.abs(gap) < 1
              ? ", thời gian đi tương đương"
              : `, ${gap > 0 ? "chậm hơn" : "nhanh hơn"} ${formatNumber(Math.abs(gap))} phút`;
    const step = farther >= 0 ? `xa hơn ① ${formatMeters(farther)}` : `gần hơn ① ${formatMeters(-farther)}`;
    return ` Đang xem ${MARKS[selected] ?? selected + 1} ${chosen.name}: ${step}${minutes}.`;
}

/**
 * Kế hoạch vẽ dẫn chứng của tiêu chí tại `origin`. Tiêu chí có tuyến vẽ tuyến tới MỌI lựa chọn cùng lúc (mỗi lựa
 * chọn một màu, khớp số trên ghim); `selected` là tuyến được làm nổi. `routes` là các tuyến đã lấy được; lựa chọn
 * chưa có tuyến thì tạm nét đứt nối thẳng. Trả null nếu tiêu chí chưa có gì để vẽ.
 */
export function planEvidence(item: EvaluatedCriterion, origin: MapPoint, selected = 0, routes: EvidenceRoutes = {}): EvidencePlan | null {
    if (!hasEvidence(item)) return null;
    const method = base(item);
    const options = item.evidence;
    const pick = Math.min(Math.max(0, selected), Math.max(0, options.length - 1));
    const straight = (to: MapPoint, color: string, emphasis?: EvidenceLine["emphasis"]): EvidenceLine => ({
        coordinates: [
            [origin.lng, origin.lat],
            [to.lng, to.lat],
        ],
        style: "connector",
        color,
        emphasis,
    });

    if (method === "nearest" || method === "travel_time" || method === "anchor") {
        const routed = ROUTED.has(item.id);
        const many = options.length > 1;
        const colorOf = (index: number): string => (many ? CHOICE_COLORS[index % CHOICE_COLORS.length] : method === "nearest" ? COLORS.green : COLORS.blue);
        const areas: EvidenceArea[] = [];
        if (item.radiusM && method === "nearest") areas.push({ ring: ringOf(origin, item.radiusM), color: COLORS.green, opacity: 0.06, outline: true });
        if (method === "anchor") {
            for (const radius of INNER_RINGS_M) areas.push({ ring: ringOf(options[0], radius), color: COLORS.slate, opacity: 0, outline: true, fit: false });
        }
        const points: EvidencePoint[] = options.map((option, index) => ({
            lat: option.lat,
            lng: option.lng,
            emphasis: index === pick ? "target" : "other",
            label: choiceLabel(item, option, index, options.length),
            color: routed ? colorOf(index) : index === pick ? colorOf(0) : COLORS.slate,
            weight: index === pick ? 1 : 0.8,
            choice: many && routed ? index : null,
        }));
        // Tuyến tới mọi lựa chọn; tuyến đang chọn vẽ sau cùng để nằm trên.
        const lines: EvidenceLine[] = routed
            ? options
                  .map((option, index): EvidenceLine => {
                      const route = routes[index];
                      const emphasis = index === pick ? "primary" : "secondary";
                      return route ? { coordinates: route.geometry, style: "route", color: colorOf(index), emphasis } : straight(option, colorOf(index), emphasis);
                  })
                  .sort((a, b) => (a.emphasis === "primary" ? 1 : 0) - (b.emphasis === "primary" ? 1 : 0))
            : [];
        const ringNote = item.radiusM && method === "nearest" ? ` Vòng tròn: trong ${formatMeters(item.radiusM)} đạt trọn điểm.` : "";
        const byRoad = routed ? routeSummary(options, routes) : "";
        const pickNote = many && routed ? ` Bấm số trên bản đồ để làm nổi một tuyến.${comparison(options, pick)}` : "";
        let caption: string;
        if (method === "anchor") {
            caption = `${item.detail}. Vòng nét đứt: 3, 10 và 20 km quanh Hồ Gươm.${byRoad}`;
        } else if (method === "travel_time") {
            caption = `${item.detail}.${byRoad}${pickNote}`;
        } else if (routed) {
            caption = `${many ? `Tuyến xe máy tới ${options.length} ${lowerFirst(item.label)} gần nhất.` : `Đường đi tới ${lowerFirst(item.label)} gần nhất: ${options[0].name}, ${formatMeters(options[0].distanceM)} đường chim bay.`}${byRoad}${ringNote}${pickNote}`;
        } else {
            caption = `${options.length} ${lowerFirst(item.label)} gần nhất, gần nhất cách ${formatMeters(options[0].distanceM)}.${ringNote}`;
        }
        return {
            overlay: finish({ criterionId: item.id, origin, areas, lines, points, caption, legend: null, selected: pick }),
            routeTargets: routed ? options.map((option, index) => ({ choice: index, point: { lat: option.lat, lng: option.lng } })) : [],
        };
    }

    if (method === "count") {
        const radius = item.radiusM ?? 500;
        const points: EvidencePoint[] = options.map((point) => ({
            lat: point.lat,
            lng: point.lng,
            emphasis: "other",
            label: `${point.name} · ${formatMeters(point.distanceM)}`,
            color: COLORS.amber,
            // Trừ hao tuyến tính theo khoảng cách như khi chấm điểm: gần thì đậm.
            weight: Math.max(0.25, 1 - point.distanceM / radius),
            choice: null,
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
                selected: 0,
            }),
            routeTargets: [],
        };
    }

    if (method === "line_nearest") {
        const noise = item.id === "on-giao-thong";
        const color = noise ? COLORS.red : COLORS.slate;
        const nearest = options[0];
        const areas: EvidenceArea[] = [];
        // Vùng ồn: dải 80 m đậm, 300 m nhạt quanh các đường trục.
        for (const zone of [...item.zones].sort((a, b) => b.meters - a.meters)) {
            for (const ring of zone.rings) areas.push({ ring, color: COLORS.red, opacity: zone.meters <= 100 ? 0.22 : 0.09, outline: false });
        }
        if (item.radiusM) areas.push({ ring: ringOf(origin, item.radiusM), color, opacity: 0, outline: true });
        const roads: EvidenceLine[] = item.paths.map((coordinates) => ({ coordinates, style: "road", color: noise ? COLORS.red : COLORS.amber }));
        const legend: Array<[string, string]> | null =
            noise && item.zones.length > 0
                ? item.zones
                      .map((zone): [string, string] => [zone.meters <= 100 ? "rgba(192,57,43,0.45)" : "rgba(192,57,43,0.2)", `trong ${formatMeters(zone.meters)} quanh đường trục`])
                      .sort((a, b) => a[1].localeCompare(b[1]))
                : null;
        return {
            overlay: finish({
                criterionId: item.id,
                origin,
                areas,
                lines: [...roads, ...(nearest ? [straight(nearest, color)] : [])],
                points: nearest ? [{ lat: nearest.lat, lng: nearest.lng, emphasis: "target", label: `${nearest.name} · ${formatMeters(nearest.distanceM)}`, color, weight: 1, choice: null }] : [],
                caption: noise
                    ? nearest
                        ? `Đường trục gần nhất cách ${formatMeters(nearest.distanceM)}. Vùng tô đỏ: trong 80 m và 300 m quanh đường trục; ngoài vòng ${formatMeters(item.radiusM ?? 600)} được coi là yên tĩnh.`
                        : `${item.detail}.`
                    : `Đoạn đường lớn gần nhất (tô vàng): ${nearest?.name ?? ""}, cách ${formatMeters(nearest?.distanceM ?? 0)}.`,
                legend,
                selected: 0,
            }),
            routeTargets: [],
        };
    }

    if (method.startsWith("grid_")) {
        const size = item.cellM ?? 100;
        const elevation = item.id === "do-cao";
        let areas: EvidenceArea[];
        let legend: Array<[string, string]> | null;
        let what: string;
        if (elevation) {
            // Độ cao tương đối: so mỗi ô với ô chứa địa điểm.
            const center = [...item.cells].sort((a, b) => Math.hypot(a.lat - origin.lat, a.lng - origin.lng) - Math.hypot(b.lat - origin.lat, b.lng - origin.lng))[0];
            areas = item.cells.map((cell) => {
                const delta = cell.value - center.value;
                const step = DIVERGING_ELEVATION.find((entry) => delta <= entry.max) ?? DIVERGING_ELEVATION[DIVERGING_ELEVATION.length - 1];
                return { ring: cellRing(cell, size), color: step.color, opacity: 0.55, outline: false };
            });
            legend = DIVERGING_ELEVATION.map((entry): [string, string] => [entry.color, entry.label]);
            what = "Cao độ từng ô 100 m so với ô chứa địa điểm";
        } else {
            const palette = gridPalette(item);
            const unit = gridUnit(item);
            const values = item.cells.map((cell) => cell.value);
            const scale = classify(values, palette.length);
            areas = item.cells.map((cell) => ({
                ring: cellRing(cell, size),
                color: palette[scale.index(cell.value)],
                // Ngập sông: ô không ngập (0) để trong suốt hơn.
                opacity: item.id === "ngap-song" && cell.value <= 0 ? 0.12 : 0.55,
                outline: false,
            }));
            legend =
                values.length > 1
                    ? palette.map((color, index): [string, string] => [color, `${formatNumber(scale.breaks[index], 1)}–${formatNumber(scale.breaks[index + 1], 1)}${unit}`])
                    : null;
            what =
                item.id === "mat-do-dan-cu"
                    ? "Dân số ước tính từng ô 100 m"
                    : item.id === "mang-xanh"
                      ? "Tỷ lệ diện tích có cây từng ô 100 m"
                      : "Độ sâu ngập mô hình (chu kỳ 100 năm) từng ô 100 m; điểm chấm theo ô chứa địa điểm";
        }
        if (item.radiusM) areas.push({ ring: ringOf(origin, item.radiusM), color: COLORS.slate, opacity: 0, outline: true });
        return {
            overlay: finish({
                criterionId: item.id,
                origin,
                areas,
                lines: [],
                points: [],
                caption: `${what}${item.radiusM ? ` trong ${formatMeters(item.radiusM)}` : ""}. ${item.detail}.`,
                legend,
                selected: 0,
            }),
            routeTargets: [],
        };
    }

    if (method === "air_station") {
        const points: EvidencePoint[] = options.map((option, index) => ({
            lat: option.lat,
            lng: option.lng,
            emphasis: index === 0 ? "target" : "other",
            label: choiceLabel(item, option, index, options.length),
            color: index === 0 ? COLORS.violet : COLORS.slate,
            weight: 1,
            choice: null,
        }));
        const spread =
            options.length > 1 && options[0].value !== undefined && options[1].value !== undefined
                ? ` Hai trạm lệch nhau ${formatNumber(Math.abs(options[0].value - options[1].value))} µg/m³.`
                : "";
        return {
            overlay: finish({
                criterionId: item.id,
                origin,
                areas: item.radiusM ? [{ ring: ringOf(origin, item.radiusM), color: COLORS.violet, opacity: 0, outline: true }] : [],
                lines: [straight(options[0], COLORS.violet)],
                points,
                caption: `Trạm quan trắc gần nhất cách ${formatMeters(options[0].distanceM)}. ${item.detail}.${spread}`,
                legend: null,
                selected: 0,
            }),
            routeTargets: [],
        };
    }
    return null;
}

/** " Theo đường đi: ① 960 m · 2 phút; ② 1,2 km · 3 phút." cho các lựa chọn đã có tuyến. */
function routeSummary(options: readonly MeasurementEvidence[], routes: EvidenceRoutes): string {
    const parts = options.flatMap((_, index) => {
        const route = routes[index];
        if (!route) return [];
        const mark = options.length > 1 ? `${MARKS[index] ?? index + 1} ` : "";
        return [`${mark}${formatMeters(route.distanceM)} · ${Math.max(1, Math.round(route.durationS / 60))} phút`];
    });
    return parts.length > 0 ? ` Theo đường đi: ${parts.join("; ")}.` : "";
}
