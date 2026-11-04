import type { MapPoint, MapStyleId, RouteVehicle } from "@/features/map/map.types";

/** Hộp bao Việt Nam [minLng, minLat, maxLng, maxLat] — khớp backend. */
export const VN_BOUNDS = [102.0, 8.0, 110.0, 24.0] as const;
export const ZOOM_RANGE = { min: 4, max: 20 } as const;
export const PITCH_MAX = 60;
export const RADIUS_RANGE = { min: 50, max: 50000 } as const;
export const QUERY_MAX = 120;
export const MAP_STYLE_IDS: readonly MapStyleId[] = ["tm", "lm", "dm", "hm"];
export const ROUTE_VEHICLE_IDS: readonly RouteVehicle[] = ["motorcycle", "car"];
export const SEARCH_SCOPES = ["POI", "ADDRESS", "VILLAGE", "WARD", "DIST", "CITY", "STREET"] as const;
export const ROUTE_AVOIDS = ["ferry"] as const;
export const MAP_LAYER_IDS = ["traffic"] as const;

const CATS_PATTERN = /^\d{1,6}(-\d{1,3})?(,\d{1,6}(-\d{1,3})?){0,9}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/;
const ID_MAX = 999999999;
const ROUTE_INDEX_MAX = 4;

export interface SearchFilters {
    cats?: string;
    scope?: string;
    cityId?: number;
    distId?: number;
    wardId?: number;
    radius?: number;
}

export interface MapUrlState {
    c: MapPoint | null;
    z: number | null;
    b: number | null;
    p: number | null;
    s: MapStyleId | null;
    traffic: boolean;
    q: string | null;
    filters: SearchFilters;
    pin: MapPoint | null;
    from: MapPoint | null;
    to: MapPoint | null;
    v: RouteVehicle | null;
    alt: boolean | null;
    route: number | null;
    avoid: (typeof ROUTE_AVOIDS)[number] | null;
    t: string | null;
}

export interface MapUrlError {
    param: string;
    message: string;
}

export interface MapUrlParseResult {
    state: MapUrlState;
    errors: MapUrlError[];
}

const KNOWN_PARAMS = [
    "c", "z", "b", "p", "s", "layers", "q", "cats", "scope", "city", "dist", "ward", "r",
    "pin", "from", "to", "v", "alt", "route", "avoid", "t",
] as const;

/** Các param chỉ có nghĩa khi đang chỉ đường. */
const ROUTE_ONLY = ["v", "alt", "route", "avoid", "t"] as const;

export function emptyMapUrlState(): MapUrlState {
    return {
        c: null, z: null, b: null, p: null, s: null, traffic: false, q: null, filters: {},
        pin: null, from: null, to: null, v: null, alt: null, route: null, avoid: null, t: null,
    };
}

export function inVietnam(lat: number, lng: number): boolean {
    return lat >= VN_BOUNDS[1] && lat <= VN_BOUNDS[3] && lng >= VN_BOUNDS[0] && lng <= VN_BOUNDS[2];
}

const NUMBER_PATTERN = /^-?\d{1,3}(\.\d+)?$/;

/** "lat,lng" → điểm trong Việt Nam; sai dạng/ngoài hộp bao → thông điệp lỗi. */
function parsePoint(value: string): MapPoint | string {
    const parts = value.split(",");
    if (parts.length !== 2 || !NUMBER_PATTERN.test(parts[0].trim()) || !NUMBER_PATTERN.test(parts[1].trim())) {
        return "phải có dạng vĩ độ,kinh độ, ví dụ 21.0285,105.8542";
    }
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!inVietnam(lat, lng)) {
        return "tọa độ nằm ngoài Việt Nam (vĩ độ 8–24, kinh độ 102–110); có thể bạn đã đảo vĩ độ và kinh độ";
    }
    return { lat, lng };
}

function parseNumber(value: string): number | null {
    if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return null;
    return Number(value);
}

function parseInteger(value: string): number | null {
    return /^-?\d+$/.test(value.trim()) ? Number(value) : null;
}

export function parseMapUrl(params: URLSearchParams): MapUrlParseResult {
    const state = emptyMapUrlState();
    const errors: MapUrlError[] = [];
    const fail = (param: string, message: string): void => {
        errors.push({ param, message });
    };

    // Param lạ hoặc lặp.
    for (const key of new Set(params.keys())) {
        if (!(KNOWN_PARAMS as readonly string[]).includes(key)) {
            fail(key, "không phải tham số được hỗ trợ");
        }
    }

    /** Lấy đúng một giá trị; lặp hoặc rỗng → lỗi và trả null. */
    const one = (name: string): string | null => {
        const all = params.getAll(name);
        if (all.length === 0) return null;
        if (all.length > 1) {
            fail(name, "xuất hiện nhiều lần, chỉ được một giá trị");
            return null;
        }
        if (all[0].trim() === "") {
            fail(name, "không được để trống");
            return null;
        }
        return all[0].trim();
    };

    const point = (name: "c" | "pin" | "from" | "to"): void => {
        const raw = one(name);
        if (raw === null) return;
        const parsed = parsePoint(raw);
        if (typeof parsed === "string") fail(name, parsed);
        else state[name] = parsed;
    };
    point("c");
    point("pin");
    point("from");
    point("to");

    const z = one("z");
    if (z !== null) {
        const value = parseNumber(z);
        if (value === null || value < ZOOM_RANGE.min || value > ZOOM_RANGE.max) {
            fail("z", `phải là số từ ${ZOOM_RANGE.min} đến ${ZOOM_RANGE.max}`);
        } else state.z = value;
    }
    const b = one("b");
    if (b !== null) {
        const value = parseNumber(b);
        if (value === null || value < -360 || value > 360) fail("b", "phải là số độ từ -360 đến 360");
        else state.b = value;
    }
    const p = one("p");
    if (p !== null) {
        const value = parseNumber(p);
        if (value === null || value < 0 || value > PITCH_MAX) fail("p", `phải là số độ từ 0 đến ${PITCH_MAX}`);
        else state.p = value;
    }

    const s = one("s");
    if (s !== null) {
        if ((MAP_STYLE_IDS as readonly string[]).includes(s)) state.s = s as MapStyleId;
        else fail("s", `chỉ nhận ${MAP_STYLE_IDS.join(", ")}`);
    }
    const layers = one("layers");
    if (layers !== null) {
        const items = layers.split(",").map((item) => item.trim());
        const bad = items.filter((item) => !(MAP_LAYER_IDS as readonly string[]).includes(item));
        if (bad.length) fail("layers", `không hỗ trợ lớp "${bad.join(", ")}"; chỉ nhận ${MAP_LAYER_IDS.join(", ")}`);
        else state.traffic = items.includes("traffic");
    }

    const q = one("q");
    if (q !== null) {
        // Bỏ ký tự điều khiển như backend; độ dài tính sau khi làm sạch.
        const clean = q.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
        if (clean.length < 2 || clean.length > QUERY_MAX) fail("q", `phải dài từ 2 đến ${QUERY_MAX} ký tự`);
        else state.q = clean;
    }
    const cats = one("cats");
    if (cats !== null) {
        if (CATS_PATTERN.test(cats)) state.filters.cats = cats;
        else fail("cats", "phải là mã nhóm POI như 3001 hoặc 1002-1, tối đa 10 mã ngăn bằng dấu phẩy");
    }
    const scope = one("scope");
    if (scope !== null) {
        const items = scope.split(",").map((item) => item.trim());
        const bad = items.filter((item) => !(SEARCH_SCOPES as readonly string[]).includes(item));
        if (bad.length || new Set(items).size !== items.length) {
            fail("scope", `chỉ nhận ${SEARCH_SCOPES.join(", ")} (không lặp), ngăn bằng dấu phẩy`);
        } else state.filters.scope = items.join(",");
    }
    for (const [name, key] of [["city", "cityId"], ["dist", "distId"], ["ward", "wardId"]] as const) {
        const raw = one(name);
        if (raw === null) continue;
        const value = parseInteger(raw);
        if (value === null || value < 1 || value > ID_MAX) fail(name, "phải là mã hành chính (số nguyên dương)");
        else state.filters[key] = value;
    }
    const r = one("r");
    if (r !== null) {
        const value = parseInteger(r);
        if (value === null || value < RADIUS_RANGE.min || value > RADIUS_RANGE.max) {
            fail("r", `phải là số mét từ ${RADIUS_RANGE.min} đến ${RADIUS_RANGE.max}`);
        } else state.filters.radius = value;
    }

    const v = one("v");
    if (v !== null) {
        if ((ROUTE_VEHICLE_IDS as readonly string[]).includes(v)) state.v = v as RouteVehicle;
        else fail("v", `chỉ nhận ${ROUTE_VEHICLE_IDS.join(", ")}`);
    }
    const alt = one("alt");
    if (alt !== null) {
        if (["1", "true"].includes(alt)) state.alt = true;
        else if (["0", "false"].includes(alt)) state.alt = false;
        else fail("alt", "chỉ nhận 0 hoặc 1");
    }
    const route = one("route");
    if (route !== null) {
        const value = parseInteger(route);
        if (value === null || value < 0 || value > ROUTE_INDEX_MAX) fail("route", `phải là số thứ tự tuyến từ 0 đến ${ROUTE_INDEX_MAX}`);
        else state.route = value;
    }
    const avoid = one("avoid");
    if (avoid !== null) {
        if ((ROUTE_AVOIDS as readonly string[]).includes(avoid)) state.avoid = avoid as (typeof ROUTE_AVOIDS)[number];
        else fail("avoid", `chỉ nhận ${ROUTE_AVOIDS.join(", ")}`);
    }
    const t = one("t");
    if (t !== null) {
        if (ISO_UTC_PATTERN.test(t) && !Number.isNaN(Date.parse(t))) state.t = t;
        else fail("t", "phải theo dạng ISO UTC, ví dụ 2026-11-03T01:00:00Z");
    }

    // Quan hệ giữa các param.
    const directions = state.from !== null || state.to !== null;
    if (!directions) {
        for (const name of ROUTE_ONLY) {
            if (params.has(name) && !errors.some((e) => e.param === name)) {
                fail(name, "chỉ có tác dụng khi có from hoặc to");
            }
        }
    }
    if (directions && state.pin !== null) {
        fail("pin", "bị bỏ qua vì đang ở chế độ chỉ đường (có from/to)");
        state.pin = null;
    }
    if (!directions) {
        state.v = null; state.alt = null; state.route = null; state.avoid = null; state.t = null;
    }
    return { state, errors };
}

/** Giữ dấu phẩy và hai chấm cho dễ đọc (đều hợp lệ trong query). */
const ENCODE_KEEP_COMMA = (value: string): string => encodeURIComponent(value).replace(/%2C/g, ",").replace(/%3A/g, ":");

function fmtPoint(point: MapPoint, digits = 5): string {
    return `${Number(point.lat.toFixed(digits))},${Number(point.lng.toFixed(digits))}`;
}

/** Dựng chuỗi query (không có `?`), thứ tự ổn định, bỏ giá trị mặc định. */
export function buildMapUrl(state: MapUrlState): string {
    const pairs: Array<[string, string]> = [];
    if (state.c) pairs.push(["c", fmtPoint(state.c)]);
    if (state.z !== null) pairs.push(["z", String(Number(state.z.toFixed(2)))]);
    if (state.b !== null && Math.round(state.b) !== 0) pairs.push(["b", String(Math.round(state.b))]);
    if (state.p !== null && Math.round(state.p) !== 0) pairs.push(["p", String(Math.round(state.p))]);
    if (state.s && state.s !== "tm") pairs.push(["s", state.s]);
    if (state.traffic) pairs.push(["layers", "traffic"]);
    if (state.q) pairs.push(["q", state.q]);
    const f = state.filters;
    if (f.cats) pairs.push(["cats", f.cats]);
    if (f.scope) pairs.push(["scope", f.scope]);
    if (f.cityId) pairs.push(["city", String(f.cityId)]);
    if (f.distId) pairs.push(["dist", String(f.distId)]);
    if (f.wardId) pairs.push(["ward", String(f.wardId)]);
    if (f.radius) pairs.push(["r", String(f.radius)]);
    const directions = state.from !== null || state.to !== null;
    if (!directions && state.pin) pairs.push(["pin", fmtPoint(state.pin, 6)]);
    if (state.from) pairs.push(["from", fmtPoint(state.from)]);
    if (state.to) pairs.push(["to", fmtPoint(state.to)]);
    if (directions) {
        if (state.v && state.v !== "motorcycle") pairs.push(["v", state.v]);
        if (state.alt === false) pairs.push(["alt", "0"]);
        if (state.route) pairs.push(["route", String(state.route)]);
        if (state.avoid) pairs.push(["avoid", state.avoid]);
        if (state.t) pairs.push(["t", state.t]);
    }
    return pairs.map(([key, value]) => `${key}=${ENCODE_KEEP_COMMA(value)}`).join("&");
}

/** Dạng chuẩn để so sánh hai chuỗi query bất kể cách mã hóa. */
export function canonicalQuery(query: string): string {
    return new URLSearchParams(query).toString();
}
