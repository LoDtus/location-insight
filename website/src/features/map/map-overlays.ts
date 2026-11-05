import { DISTRICT_CENTERS } from "@/features/landing-page/data/district-centers";
import { LISTINGS, type Listing } from "@/features/landing-page/data/listings";
import type { MapPoint } from "@/features/map/map.types";

/** Nhóm điểm tiện ích (khớp MAP_POI_CATEGORIES ở backend và tools/data/osm_places.py). */
export const POI_CATEGORIES = [
    "school",
    "bank",
    "market",
    "pharmacy",
    "supermarket",
    "hospital",
    "park",
    "food",
    "townhall",
    "hardware",
    "bus",
    "metro",
] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];

/** Mọi lớp hiển thị bật/tắt được (tham số URL `layers`). */
export const OVERLAY_IDS = ["listing", ...POI_CATEGORIES] as const;
export type OverlayId = (typeof OVERLAY_IDS)[number];

/** "Tiện ích khác": mọi nhóm trừ trường học và ngân hàng (có công tắc riêng). */
export const OTHER_AMENITIES: readonly PoiCategory[] = POI_CATEGORIES.filter((id) => id !== "school" && id !== "bank");

export const POI_STYLE: Record<PoiCategory, { label: string; color: string }> = {
    school: { label: "Trường học", color: "#6d28d9" },
    bank: { label: "Ngân hàng, ATM", color: "#0e7490" },
    market: { label: "Chợ", color: "#c2410c" },
    pharmacy: { label: "Hiệu thuốc", color: "#db2777" },
    supermarket: { label: "Siêu thị", color: "#ea580c" },
    hospital: { label: "Bệnh viện, phòng khám", color: "#b91c1c" },
    park: { label: "Công viên", color: "#16a34a" },
    food: { label: "Quán ăn, cà phê", color: "#a16207" },
    townhall: { label: "UBND", color: "#475569" },
    hardware: { label: "Cửa hàng vật tư", color: "#78716c" },
    bus: { label: "Điểm xe buýt", color: "#2563eb" },
    metro: { label: "Ga metro", color: "#0369a1" },
};

/** Lớp điểm tiện ích chỉ hiện từ mức zoom này (ô dữ liệu ở zoom 13). */
export const POI_MIN_ZOOM = 13;
export const POI_TILE_ZOOM = 13;
/** Nhóm rất dày (hàng nghìn điểm ở nội thành) chỉ hiện từ zoom 15. */
export const POI_DENSE_CATEGORIES: readonly PoiCategory[] = ["food", "bus"];
export const POI_DENSE_MIN_ZOOM = 15;

export function isPoiCategory(value: string): value is PoiCategory {
    return (POI_CATEGORIES as readonly string[]).includes(value);
}

/** Các ô zoom 13 phủ hộp bao [w, s, e, n]; tối đa `max` ô (khung nhìn quá rộng thì trả rỗng). */
export function tilesFor(bounds: readonly [number, number, number, number], max = 30): Array<{ x: number; y: number }> {
    const n = 2 ** POI_TILE_ZOOM;
    const xOf = (lng: number): number => Math.floor(((lng + 180) / 360) * n);
    const yOf = (lat: number): number => {
        const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
        return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
    };
    const [west, south, east, north] = bounds;
    const x0 = xOf(west);
    const x1 = xOf(east);
    const y0 = yOf(north);
    const y1 = yOf(south);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > max) return [];
    const tiles: Array<{ x: number; y: number }> = [];
    for (let x = x0; x <= x1; x += 1) for (let y = y0; y <= y1; y += 1) tiles.push({ x, y });
    return tiles;
}

/** Băm chuỗi ổn định (FNV-1a) → [0, 1). */
function unit(seed: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0) / 0x100000000;
}

export interface ListingPin {
    listing: Listing;
    point: MapPoint;
    /** Tin chưa có tọa độ: đặt gần tâm quận, chỉ là vị trí gần đúng. */
    approximate: boolean;
}

/**
 * Vị trí tin rao trên bản đồ: tọa độ tin nếu có; không thì một điểm cố định (theo mã tin) trong ~1,5 km quanh
 * tâm quận, đánh dấu gần đúng.
 */
export function listingPins(source: readonly Listing[] = LISTINGS): ListingPin[] {
    return source.flatMap((listing): ListingPin[] => {
        const lat = listing.extra?.lat;
        const lng = listing.extra?.lng;
        if (typeof lat === "number" && typeof lng === "number") return [{ listing, point: { lat, lng }, approximate: false }];
        const center = DISTRICT_CENTERS[listing.district];
        if (!center) return [];
        const angle = unit(`${listing.id}:a`) * 2 * Math.PI;
        const distanceM = 250 + unit(`${listing.id}:d`) * 1250;
        const dLat = (distanceM * Math.cos(angle)) / 111_320;
        const dLng = (distanceM * Math.sin(angle)) / (111_320 * Math.cos((center.lat * Math.PI) / 180));
        return [{ listing, point: { lat: center.lat + dLat, lng: center.lng + dLng }, approximate: true }];
    });
}

/** Nhãn giá ngắn trên ghim: "3,2 tỷ", "12 tr/th". */
export function shortPrice(listing: Pick<Listing, "priceVnd" | "purpose">): string {
    if (listing.purpose === "thue") {
        return `${(Math.round(listing.priceVnd / 100_000) / 10).toString().replace(".", ",")} tr/th`;
    }
    const billions = listing.priceVnd / 1_000_000_000;
    if (billions >= 1) return `${(Math.round(billions * 10) / 10).toString().replace(".", ",")} tỷ`;
    return `${Math.round(listing.priceVnd / 1_000_000)} tr`;
}
