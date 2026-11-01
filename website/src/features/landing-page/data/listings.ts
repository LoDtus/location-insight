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
    slug: string;
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
    watchers: number;
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
        slug: "nha-mat-pho-hang-bac",
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
        slug: "nha-pho-van-mieu",
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
        slug: "can-ho-bach-mai",
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
        slug: "studio-cau-giay",
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
        slug: "nha-pho-ho-tay",
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
        slug: "can-ho-masteri-waterfront",
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
        slug: "can-ho-linh-dam",
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
        slug: "can-ho-smart-city",
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
        slug: "biet-thu-ciputra",
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
        slug: "dat-dong-anh",
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
        slug: "dat-lai-xa",
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
        slug: "biet-thu-riverside",
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
        slug: "can-ho-times-city",
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
        slug: "nha-pho-doi-can",
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
        slug: "can-ho-matrix-one",
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
    {
        id: "019a2b10-0010-7000-8000-000000000010",
        slug: "can-ho-my-dinh",
        title: "Căn hộ 2 ngủ Mỹ Đình",
        location: "Mỹ Đình, phường Từ Liêm",
        district: "Nam Từ Liêm",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 4_200_000_000,
        areaM2: 78,
        beds: 2,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-28",
    },
    {
        id: "019a2b10-0011-7000-8000-000000000011",
        slug: "nha-pho-ngo-truc",
        title: "Nhà phố ngõ Trúc",
        location: "Ngõ Trúc, phường Ba Đình",
        district: "Ba Đình",
        purpose: "ban",
        kind: "nha-pho",
        priceVnd: 9_800_000_000,
        areaM2: 42,
        beds: 4,
        living: 1,
        baths: 3,
        updatedAt: "2026-10-27",
    },
    {
        id: "019a2b10-0012-7000-8000-000000000012",
        slug: "dat-dich-vu-hoai-duc",
        title: "Đất dịch vụ Lai Xá",
        location: "Lai Xá, huyện Hoài Đức",
        district: "Hoài Đức",
        purpose: "ban",
        kind: "dat",
        priceVnd: 1_850_000_000,
        areaM2: 72,
        beds: 0,
        living: 0,
        baths: 0,
        updatedAt: "2026-10-09",
    },
    {
        id: "019a2b10-0013-7000-8000-000000000013",
        slug: "can-ho-thue-van-chuong",
        title: "Căn hộ 2 ngủ cho thuê Văn Chương",
        location: "Văn Chương, phường Văn Miếu - Quốc Tử Giám",
        district: "Đống Đa",
        purpose: "thue",
        kind: "can-ho",
        priceVnd: 18_000_000,
        areaM2: 85,
        beds: 2,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-26",
    },
    {
        id: "019a2b10-0014-7000-8000-000000000014",
        slug: "biet-thu-ban-ciputra",
        title: "Biệt thự bán khu Ciputra",
        location: "Khu Ciputra, phường Phú Thượng",
        district: "Bắc Từ Liêm",
        purpose: "ban",
        kind: "biet-thu",
        priceVnd: 42_000_000_000,
        areaM2: 250,
        beds: 5,
        living: 2,
        baths: 5,
        updatedAt: "2026-10-08",
    },
    {
        id: "019a2b10-0015-7000-8000-000000000015",
        slug: "studio-thue-dich-vong",
        title: "Studio cho thuê Dịch Vọng",
        location: "Dịch Vọng, phường Cầu Giấy",
        district: "Cầu Giấy",
        purpose: "thue",
        kind: "can-ho",
        priceVnd: 7_500_000,
        areaM2: 28,
        beds: 1,
        living: 1,
        baths: 1,
        updatedAt: "2026-10-25",
    },
    {
        id: "019a2b10-0016-7000-8000-000000000016",
        slug: "nha-mat-pho-tay-son",
        title: "Nhà mặt phố Tây Sơn",
        location: "Tây Sơn, phường Kim Liên",
        district: "Đống Đa",
        purpose: "ban",
        kind: "nha-pho",
        priceVnd: 21_000_000_000,
        areaM2: 55,
        beds: 4,
        living: 1,
        baths: 3,
        updatedAt: "2026-10-07",
    },
    {
        id: "019a2b10-0017-7000-8000-000000000017",
        slug: "can-ho-dinh-cong",
        title: "Căn hộ 3 ngủ Định Công",
        location: "Định Công, phường Định Công",
        district: "Hoàng Mai",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 3_800_000_000,
        areaM2: 92,
        beds: 3,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-06",
    },
    {
        id: "019a2b10-0018-7000-8000-000000000018",
        slug: "dat-co-bi",
        title: "Đất thổ cư Cổ Bi",
        location: "Cổ Bi, huyện Đông Anh",
        district: "Đông Anh",
        purpose: "ban",
        kind: "dat",
        priceVnd: 2_100_000_000,
        areaM2: 100,
        beds: 0,
        living: 0,
        baths: 0,
        updatedAt: "2026-09-28",
    },
    {
        id: "019a2b10-0019-7000-8000-000000000019",
        slug: "can-ho-thue-quang-an",
        title: "Căn hộ cho thuê Quảng An",
        location: "Quảng An, phường Tây Hồ",
        district: "Tây Hồ",
        purpose: "thue",
        kind: "can-ho",
        priceVnd: 25_000_000,
        areaM2: 90,
        beds: 2,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-29",
    },
    {
        id: "019a2b10-001a-7000-8000-00000000001a",
        slug: "nha-pho-ngoc-lam",
        title: "Nhà phố Ngọc Lâm",
        location: "Ngọc Lâm, phường Bồ Đề",
        district: "Long Biên",
        purpose: "ban",
        kind: "nha-pho",
        priceVnd: 6_400_000_000,
        areaM2: 50,
        beds: 3,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-05",
    },
    {
        id: "019a2b10-001b-7000-8000-00000000001b",
        slug: "biet-thu-thue-nhat-tan",
        title: "Biệt thự cho thuê Nhật Tân",
        location: "Nhật Tân, phường Tây Hồ",
        district: "Tây Hồ",
        purpose: "thue",
        kind: "biet-thu",
        priceVnd: 80_000_000,
        areaM2: 300,
        beds: 5,
        living: 2,
        baths: 4,
        updatedAt: "2026-10-04",
    },
    {
        id: "019a2b10-001c-7000-8000-00000000001c",
        slug: "can-ho-hang-bong",
        title: "Căn hộ Hàng Bông",
        location: "Hàng Bông, phường Hoàn Kiếm",
        district: "Hoàn Kiếm",
        purpose: "ban",
        kind: "can-ho",
        priceVnd: 8_200_000_000,
        areaM2: 70,
        beds: 2,
        living: 1,
        baths: 2,
        updatedAt: "2026-10-30",
    },
] as const;

const WATCHERS = [
    128, 24, 41, 12, 96, 33, 19, 15, 28, 9, 7, 84, 22, 11, 37, 18, 44, 6, 31, 21, 8, 52, 14, 5, 27, 16, 39, 48,
];

export const LISTINGS: Listing[] = RAW.map((item, index) => ({
    ...item,
    watchers: WATCHERS[index] ?? 0,
    images: [0, 1, 2].map(
        (offset) => LISTING_IMAGES[(index + offset) % LISTING_IMAGES.length],
    ),
}));

export type ListingBadge = "moi" | "gia-tot" | "quan-tam";

const NEW_SINCE = "2026-10-18";

export function listingBadges(listing: Listing): ListingBadge[] {
    const badges: ListingBadge[] = [];

    if (listing.updatedAt >= NEW_SINCE) {
        badges.push("moi");
    }

    const peers = LISTINGS.filter(
        (item) => item.purpose === listing.purpose && item.kind === listing.kind,
    );

    if (peers.length >= 4) {
        const rates = peers.map((item) => item.priceVnd / item.areaM2).sort((left, right) => left - right);
        const cutoff = rates[Math.max(0, Math.ceil(peers.length * 0.25) - 1)] ?? rates[0];

        if (listing.priceVnd / listing.areaM2 <= cutoff) {
            badges.push("gia-tot");
        }
    }

    const mostWatched = [...LISTINGS]
        .sort((left, right) => right.watchers - left.watchers || left.id.localeCompare(right.id))
        .slice(0, 3);

    if (mostWatched.some((item) => item.id === listing.id)) {
        badges.push("quan-tam");
    }

    return badges;
}

export function getListingById(id: string): Listing | undefined {
    return LISTINGS.find((listing) => listing.id === id);
}

export function getListingByParam(param: string): Listing | undefined {
    return (
        LISTINGS.find((listing) => listing.slug === param) ?? getListingById(param)
    );
}

export function listingPath(listing: Pick<Listing, "slug">): string {
    return `/nha-dat/${listing.slug}`;
}

export const MAP_PLACE_SLUG = "can-ho-matrix-one";

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
