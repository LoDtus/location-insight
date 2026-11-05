import { LISTINGS, type Listing } from "@/features/landing-page/data/listings";
import type { MapPlace, MapPlaceKind, MapPoint } from "@/features/map/map.types";

/** Bán kính coi tin rao có tọa độ là cùng địa điểm. */
const SAME_PLACE_M = 60;
/** Tên quá ngắn (vd. "12") khớp bừa với mọi tin; bỏ qua. */
const MIN_NAME_LENGTH = 4;

export const PLACE_KIND_LABEL: Record<MapPlaceKind, string> = {
    poi: "Địa điểm, cơ sở",
    address: "Số nhà, địa chỉ",
    street: "Tuyến đường",
    ward: "Phường, xã",
    district: "Quận, huyện",
    city: "Tỉnh, thành phố",
    village: "Thôn, làng",
    unknown: "Vị trí trên bản đồ",
};

/** Bỏ dấu, đ→d, thường hóa, gộp khoảng trắng để so tên. */
export function foldName(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function distanceM(a: MapPoint, b: MapPoint): number {
    const rad = (deg: number): number => (deg * Math.PI) / 180;
    const h =
        Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

export interface PlaceListingMatch {
    listings: Listing[];
    /** Tổng số người đang theo dõi các tin rao tại địa điểm. */
    watchers: number;
    images: string[];
}

/**
 * Tin rao thuộc cùng địa điểm: tin có tọa độ trong 60 m, hoặc tiêu đề/vị trí tin chứa tên địa điểm.
 * Dùng để lấy ảnh và số người quan tâm cho thẻ "Địa điểm".
 */
export function matchListings(place: Pick<MapPlace, "name"> | null, point: MapPoint, source: readonly Listing[] = LISTINGS): PlaceListingMatch {
    const name = place ? foldName(place.name) : "";
    const byName = name.length >= MIN_NAME_LENGTH && !/^\d+( \d+)*$/.test(name);
    const listings = source.filter((listing) => {
        const lat = listing.extra?.lat;
        const lng = listing.extra?.lng;
        if (typeof lat === "number" && typeof lng === "number" && distanceM(point, { lat, lng }) <= SAME_PLACE_M) return true;
        if (!byName) return false;
        return foldName(listing.title).includes(name) || foldName(listing.location).includes(name);
    });
    const images = [...new Set(listings.flatMap((listing) => listing.images))].slice(0, 12);
    return { listings, watchers: listings.reduce((sum, listing) => sum + listing.watchers, 0), images };
}
