export const LISTING_IMAGES = [
    "/images/temp-002.jpg",
    "/images/temp-003.jpg",
    "/images/temp-004.jpg",
] as const;

export const LISTING_KINDS = ["can-ho", "nha-pho", "biet-thu", "dat"] as const;

export const LISTING_PURPOSES = ["ban", "thue"] as const;

export const DISTRICTS = [
    "Hoàn Kiếm",
    "Ba Đình",
    "Đống Đa",
    "Hai Bà Trưng",
    "Cầu Giấy",
    "Tây Hồ",
    "Long Biên",
    "Hoàng Mai",
    "Nam Từ Liêm",
    "Bắc Từ Liêm",
    "Đông Anh",
    "Hoài Đức",
] as const;

export type ListingKind = (typeof LISTING_KINDS)[number];
export type ListingPurpose = (typeof LISTING_PURPOSES)[number];
export type District = (typeof DISTRICTS)[number];

export type Listing = {
    id: string;
    title: string;
    location: string;
    district: District;
    purpose: ListingPurpose;
    kind: ListingKind;
    priceVnd: number;
    areaM2: number;
    beds: number;
    living: number;
    baths: number;
    updatedAt: string;
    images: readonly string[];
};

export const SALE_PRICE_RANGES = [
    { id: "under-3", min: 0, max: 3_000_000_000 },
    { id: "3-7", min: 3_000_000_000, max: 7_000_000_000 },
    { id: "7-15", min: 7_000_000_000, max: 15_000_000_000 },
    { id: "over-15", min: 15_000_000_000, max: Number.POSITIVE_INFINITY },
] as const;

export const RENT_PRICE_RANGES = [
    { id: "under-10", min: 0, max: 10_000_000 },
    { id: "10-20", min: 10_000_000, max: 20_000_000 },
    { id: "20-40", min: 20_000_000, max: 40_000_000 },
    { id: "over-40", min: 40_000_000, max: Number.POSITIVE_INFINITY },
] as const;

export const SORT_KEYS = ["updated", "price-asc", "price-desc", "area"] as const;

export type SortKey = (typeof SORT_KEYS)[number];

const RAW = [
    {
        id: "019a2b10-0001-7000-8000-000000000001",
        title: "Nhà mặt phố Hàng Bạc",
        location: "Hàng Bạc, phường Hoàn Kiếm",
        district: "Hoàn Kiếm",
        purpose: "ban",
        kind: "nha-pho",
        priceVnd: 46_000_000_000,
        areaM2: 60,
        beds: 3,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-24",
    },
    {
        id: "019a2b10-0002-7000-8000-000000000002",
        title: "Nhà phố 4 tầng ngõ Văn Miếu",
        location: "Ngõ Văn Miếu, phường Văn Miếu - Quốc Tử Giám",
        district: "Đống Đa",
        purpose: "ban",
        kind: "nha-pho",
        priceVnd: 12_600_000_000,
        areaM2: 48,
        beds: 4,
        living: 1,
        baths: 3,
        updatedAt: "2026-10-23",
    },
    {
        id: "019a2b10-0003-7000-8000-000000000003",
        title: "Căn hộ 2 ngủ gần Bệnh viện Bạch Mai",
        location: "Phố Bạch Mai, phường Bạch Mai",
        district: "Hai Bà Trưng",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 3_450_000_000,
        areaM2: 68,
        beds: 2,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-22",
    },
    {
        id: "019a2b10-0004-7000-8000-000000000004",
        title: "Studio cho thuê gần Đại học Quốc gia",
        location: "Xuân Thủy, phường Cầu Giấy",
        district: "Cầu Giấy",
        purpose: "thue",
        kind: "can-ho",
        priceVnd: 8_500_000,
        areaM2: 32,
        beds: 1,
        living: 1,
        baths: 1,
        updatedAt: "2026-10-21",
    },
    {
        id: "019a2b10-0005-7000-8000-000000000005",
        title: "Nhà phố view hồ Tây",
        location: "Quảng An, phường Tây Hồ",
        district: "Tây Hồ",
        purpose: "ban",
        kind: "nha-pho",
        priceVnd: 18_900_000_000,
        areaM2: 75,
        beds: 3,
        living: 1,
        baths: 3,
        updatedAt: "2026-10-20",
    },
    {
        id: "019a2b10-0006-7000-8000-000000000006",
        title: "Căn hộ 2 ngủ Masteri Waterfront",
        location: "Masteri Waterfront, phường Long Biên",
        district: "Long Biên",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 4_850_000_000,
        areaM2: 72,
        beds: 2,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-19",
    },
    {
        id: "019a2b10-0007-7000-8000-000000000007",
        title: "Căn hộ 3 ngủ Linh Đàm",
        location: "Khu đô thị Linh Đàm, phường Hoàng Liệt",
        district: "Hoàng Mai",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 3_150_000_000,
        areaM2: 88,
        beds: 3,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-18",
    },
    {
        id: "019a2b10-0008-7000-8000-000000000008",
        title: "Căn hộ 1 ngủ Vinhomes Smart City",
        location: "Vinhomes Smart City, phường Tây Mỗ",
        district: "Nam Từ Liêm",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 2_900_000_000,
        areaM2: 48,
        beds: 1,
        living: 1,
        baths: 1,
        updatedAt: "2026-10-17",
    },
    {
        id: "019a2b10-0009-7000-8000-000000000009",
        title: "Biệt thự cho thuê Ciputra",
        location: "Khu Ciputra, phường Phú Thượng",
        district: "Bắc Từ Liêm",
        purpose: "thue",
        kind: "biet-thu",
        priceVnd: 65_000_000,
        areaM2: 220,
        beds: 5,
        living: 2,
        baths: 4,
        updatedAt: "2026-10-16",
    },
    {
        id: "019a2b10-000a-7000-8000-00000000000a",
        title: "Đất nền gần Nội Bài",
        location: "Xã Nguyên Khê, huyện Đông Anh",
        district: "Đông Anh",
        purpose: "ban",
        kind: "dat",
        priceVnd: 3_150_000_000,
        areaM2: 90,
        beds: 0,
        living: 0,
        baths: 0,
        updatedAt: "2026-10-15",
    },
    {
        id: "019a2b10-000b-7000-8000-00000000000b",
        title: "Đất thổ cư Lai Xá",
        location: "Lai Xá, huyện Hoài Đức",
        district: "Hoài Đức",
        purpose: "ban",
        kind: "dat",
        priceVnd: 2_450_000_000,
        areaM2: 80,
        beds: 0,
        living: 0,
        baths: 0,
        updatedAt: "2026-10-14",
    },
    {
        id: "019a2b10-000c-7000-8000-00000000000c",
        title: "Biệt thự Vinhomes Riverside",
        location: "Vinhomes Riverside, phường Phúc Lợi",
        district: "Long Biên",
        purpose: "ban",
        kind: "biet-thu",
        priceVnd: 28_500_000_000,
        areaM2: 180,
        beds: 4,
        living: 2,
        baths: 4,
        updatedAt: "2026-10-13",
    },
    {
        id: "019a2b10-000d-7000-8000-00000000000d",
        title: "Căn hộ 2 ngủ cho thuê Times City",
        location: "Times City, phường Vĩnh Tuy",
        district: "Hai Bà Trưng",
        purpose: "thue",
        kind: "can-ho",
        priceVnd: 15_000_000,
        areaM2: 68,
        beds: 2,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-12",
    },
    {
        id: "019a2b10-000e-7000-8000-00000000000e",
        title: "Nhà phố cho thuê Đội Cấn",
        location: "Đội Cấn, phường Ngọc Hà",
        district: "Ba Đình",
        purpose: "thue",
        kind: "nha-pho",
        priceVnd: 22_000_000,
        areaM2: 55,
        beds: 3,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-11",
    },
    {
        id: "019a2b10-000f-7000-8000-00000000000f",
        title: "Căn hộ 3 ngủ The Matrix One",
        location: "The Matrix One, phường Mễ Trì",
        district: "Nam Từ Liêm",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 7_400_000_000,
        areaM2: 96,
        beds: 3,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-10",
    },
] as const;

export const LISTINGS: Listing[] = RAW.map((item, index) => ({
    ...item,
    images: [0, 1, 2].map(
        (offset) => LISTING_IMAGES[(index + offset) % LISTING_IMAGES.length],
    ),
}));

export function getListingById(id: string): Listing | undefined {
    return LISTINGS.find((listing) => listing.id === id);
}

export function formatListingPrice(listing: Listing, locale: string): string {
    const vi = locale.startsWith("vi");
    const numberLocale = vi ? "vi-VN" : "en-US";

    if (listing.purpose === "thue") {
        const number = new Intl.NumberFormat(numberLocale, {
            maximumFractionDigits: 1,
        }).format(listing.priceVnd / 1_000_000);

        return vi ? `${number} triệu/tháng` : `${number} million VND/month`;
    }

    const number = new Intl.NumberFormat(numberLocale, {
        maximumFractionDigits: 2,
    }).format(listing.priceVnd / 1_000_000_000);

    return vi ? `${number} tỷ` : `${number} billion VND`;
}

export function formatPricePerArea(listing: Listing, locale: string): string {
    const vi = locale.startsWith("vi");
    const numberLocale = vi ? "vi-VN" : "en-US";
    const perSquare = listing.priceVnd / listing.areaM2;
    const number = new Intl.NumberFormat(numberLocale, {
        maximumFractionDigits: 1,
    }).format(perSquare / 1_000_000);

    if (listing.purpose === "thue") {
        return vi ? `≈ ${number} triệu/m²/tháng` : `≈ ${number} million VND/m²/month`;
    }

    return vi ? `≈ ${number} triệu/m²` : `≈ ${number} million VND/m²`;
}

export function formatListingDate(isoDate: string, locale: string): string {
    const [year, month, day] = isoDate.split("-").map(Number);

    return new Intl.DateTimeFormat(locale.startsWith("vi") ? "vi-VN" : "en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(year, month - 1, day));
}

export function formatArea(areaM2: number, locale: string): string {
    const number = new Intl.NumberFormat(locale.startsWith("vi") ? "vi-VN" : "en-US").format(
        areaM2,
    );

    return `${number} m²`;
}
