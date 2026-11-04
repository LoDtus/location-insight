import { createHash } from 'node:crypto';
import {
  MAP_MAX_ROUTE_POINTS,
  MAP_MAX_SUGGESTIONS,
  MAP_TEXT_MAX,
  VN_BOUNDS,
} from './map.constants.js';
import type {
  Congestion,
  MapPlace,
  MapRoute,
  MapRouteStep,
  MapSuggestion,
} from './map.types.js';

type Json = Record<string, unknown>;

const CONGESTION_LEVELS: readonly Congestion[] = [
  'low',
  'moderate',
  'heavy',
  'severe',
  'unknown',
];

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, max = 300): string {
  return typeof value === 'string' ? cleanText(value, max) : '';
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Bỏ ký tự điều khiển, gộp khoảng trắng, cắt độ dài. */
export function cleanText(value: string, max = MAP_TEXT_MAX): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function inVietnam(lat: number, lng: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = VN_BOUNDS;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

/** Khóa cache gợi ý: chữ chuẩn hóa + focus làm tròn ~1 km. Không chứa userId. */
export interface SearchFilters {
  cats?: string;
  scope?: string;
  cityId?: number;
  distId?: number;
  wardId?: number;
  radius?: number;
}

export function searchCacheKey(
  text: string,
  lat: number,
  lng: number,
  limit: number,
  filters: SearchFilters = {},
): string {
  const normalized = cleanText(text).toLocaleLowerCase('vi');
  // Có bán kính thì focus là tâm vòng tròn: làm tròn mịn hơn (~100 m) để kết quả đúng vùng.
  const digits = filters.radius ? 3 : 2;
  const extra = [filters.cats, filters.scope, filters.cityId, filters.distId, filters.wardId, filters.radius]
    .map((value) => value ?? '')
    .join(',');
  return hash(`${normalized}|${roundTo(lat, digits)}|${roundTo(lng, digits)}|${limit}|${extra}`);
}

export function reverseCacheKey(lat: number, lng: number): string {
  return `${roundTo(lat, 5)},${roundTo(lng, 5)}`;
}

export function routeCacheKey(
  from: [number, number],
  to: [number, number],
  vehicle: string,
  alternatives: boolean,
  avoid = '',
  departAt = '',
): string {
  const part = (p: [number, number]) => `${roundTo(p[0], 5)},${roundTo(p[1], 5)}`;
  return `${vehicle}|${alternatives ? 'alt' : 'one'}|${part(from)}|${part(to)}|${avoid}|${departAt}`;
}

/** Giờ khởi hành ISO 8601 UTC hợp lệ → làm tròn xuống 15 phút (giao thông không đổi nhanh hơn). */
export function normalizeDepartAt(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  const quarter = 15 * 60 * 1000;
  return new Date(Math.floor(time / quarter) * quarter).toISOString().replace('.000Z', 'Z');
}

/** Ẩn khóa API khỏi URL trước khi ghi log/lỗi. */
export function redactUrl(url: string): string {
  return url.replace(/([?&]apikey=)[^&#]*/gi, '$1***');
}

/** Parse "lat,lng" → [lat, lng] hoặc null nếu sai hình dạng/ngoài Việt Nam. */
export function parseLatLng(value: string): [number, number] | null {
  const match = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return inVietnam(lat, lng) ? [lat, lng] : null;
}

/** Vietmap có chỗ trả "A,B" không khoảng trắng; chuẩn hóa thành "A, B". */
function tidy(value: string): string {
  return value.replace(/\s*,\s*/g, ', ');
}

function addressParts(raw: Json): {
  address: string;
  addressOld: string | null;
  display: string;
} {
  const old = {
    address: tidy(str(raw.address)),
    display: tidy(str(raw.display)),
  };
  const fresh = isObject(raw.data_new) ? raw.data_new : null;
  const newAddress = fresh ? tidy(str(fresh.address)) : '';
  const newDisplay = fresh ? tidy(str(fresh.display)) : '';
  if (newAddress) {
    return {
      address: newAddress,
      addressOld: old.address && old.address !== newAddress ? old.address : null,
      display: newDisplay || old.display,
    };
  }
  return { address: old.address, addressOld: null, display: old.display };
}

export function toSuggestions(
  raw: unknown,
  limit = MAP_MAX_SUGGESTIONS,
): MapSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: MapSuggestion[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const refId = str(item.ref_id, 1500);
    const name = str(item.name) || str(item.display);
    if (!refId || !name) continue;
    const parts = addressParts(item);
    out.push({
      refId,
      name,
      address: parts.address,
      addressOld: parts.addressOld,
      display: parts.display || name,
      distanceKm: num(item.distance),
    });
    if (out.length >= Math.min(limit, MAP_MAX_SUGGESTIONS)) break;
  }
  return out;
}

export function toPlaceFromPlace(raw: unknown): MapPlace | null {
  if (!isObject(raw)) return null;
  const lat = num(raw.lat);
  const lng = num(raw.lng);
  if (lat === null || lng === null || !inVietnam(lat, lng)) return null;
  const display = tidy(str(raw.display));
  // `address` đôi khi đã chứa quận/phường/thành phố: chỉ thêm phần chưa xuất hiện.
  let address = '';
  for (const part of [str(raw.address), str(raw.ward), str(raw.district), str(raw.city)]) {
    if (part && !address.includes(part)) address = address ? `${address}, ${part}` : part;
  }
  address = tidy(address);
  return {
    lat,
    lng,
    name: str(raw.name) || str(raw.address) || display,
    address: address || display,
    addressOld: null,
    display: display || address,
  };
}

const EARTH_RADIUS_M = 6371008.8;

/** Khoảng cách đường chim bay (mét) giữa hai điểm, công thức haversine. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function toPlaceFromReverse(raw: unknown): MapPlace | null {
  if (!Array.isArray(raw) || !isObject(raw[0])) return null;
  const item = raw[0];
  const lat = num(item.lat);
  const lng = num(item.lng);
  if (lat === null || lng === null) return null;
  const parts = addressParts(item);
  const name = str(item.name) || (isObject(item.data_new) ? str(item.data_new.name) : '');
  if (!name && !parts.display) return null;
  return {
    lat,
    lng,
    name: name || parts.display,
    address: parts.address,
    addressOld: parts.addressOld,
    display: parts.display || name,
  };
}

function toSteps(raw: unknown): MapRouteStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!isObject(item)) return [];
    const text = str(item.text, 200);
    if (!text) return [];
    return [
      {
        text,
        distanceM: num(item.distance) ?? 0,
        durationS: Math.round((num(item.time) ?? 0) / 1000),
        sign: Math.trunc(num(item.sign) ?? 0),
        street: str(item.street_name, 120),
      },
    ];
  });
}

/** Giản lược đều để không vượt trần số đỉnh (giữ đỉnh đầu và cuối). */
export function simplify(
  points: Array<[number, number]>,
  max = MAP_MAX_ROUTE_POINTS,
): Array<[number, number]> {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: Array<[number, number]> = [];
  for (let index = 0; index < max - 1; index += 1) {
    out.push(points[Math.round(index * step)]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Phần tử i = mức tắc của đoạn giữa đỉnh i và i+1. */
function toCongestion(annotations: unknown, segments: number): Congestion[] | null {
  if (!isObject(annotations) || !Array.isArray(annotations.congestion)) return null;
  const out: Congestion[] = Array.from({ length: segments }, (): Congestion => 'unknown');
  for (const run of annotations.congestion) {
    if (!isObject(run)) continue;
    const level = CONGESTION_LEVELS.find((value) => value === run.value);
    const first = num(run.first);
    const last = num(run.last);
    if (!level || first === null || last === null) continue;
    for (let index = Math.max(0, first); index < Math.min(last, segments); index += 1) {
      out[index] = level;
    }
  }
  return out;
}

export function toRoutes(raw: unknown): MapRoute[] {
  if (!isObject(raw) || !Array.isArray(raw.paths)) return [];
  const routes: MapRoute[] = [];
  for (const path of raw.paths) {
    if (!isObject(path) || !isObject(path.points)) continue;
    const coordinates = path.points.coordinates;
    if (!Array.isArray(coordinates)) continue;
    const geometry: Array<[number, number]> = [];
    for (const point of coordinates) {
      if (!Array.isArray(point)) continue;
      const lng = num(point[0]);
      const lat = num(point[1]);
      if (lng === null || lat === null) continue;
      geometry.push([lng, lat]);
    }
    if (geometry.length < 2) continue;
    const bboxRaw = Array.isArray(path.bbox) ? path.bbox.map(num) : [];
    const bbox = (bboxRaw.length === 4 && bboxRaw.every((v) => v !== null)
      ? bboxRaw
      : boundsOf(geometry)) as [number, number, number, number];
    const simplified = simplify(geometry);
    routes.push({
      distanceM: num(path.distance) ?? 0,
      durationS: Math.round((num(path.time) ?? 0) / 1000),
      bbox,
      geometry: simplified,
      steps: toSteps(path.instructions),
      congestion:
        simplified.length === geometry.length
          ? toCongestion(path.annotations, geometry.length - 1)
          : null,
    });
  }
  return routes;
}

function boundsOf(points: Array<[number, number]>): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLng, minLat, maxLng, maxLat];
}
