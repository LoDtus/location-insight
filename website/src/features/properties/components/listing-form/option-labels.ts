import type { ListingKind } from "@/features/landing-page/data/listings";
import type { Direction, Furnishing, LegalKind, PosterRole } from "@/features/properties/listing-extra";

type Label = { vi: string; en: string };

export const KIND_LABEL: Record<ListingKind, Label> = {
    "can-ho": { vi: "Căn hộ", en: "Apartment" },
    "nha-pho": { vi: "Nhà phố", en: "Townhouse" },
    "biet-thu": { vi: "Biệt thự", en: "Villa" },
    dat: { vi: "Đất", en: "Land" },
};

export const DIRECTION_LABEL: Record<Direction, Label> = {
    dong: { vi: "Đông", en: "East" },
    tay: { vi: "Tây", en: "West" },
    nam: { vi: "Nam", en: "South" },
    bac: { vi: "Bắc", en: "North" },
    "dong-bac": { vi: "Đông Bắc", en: "Northeast" },
    "dong-nam": { vi: "Đông Nam", en: "Southeast" },
    "tay-bac": { vi: "Tây Bắc", en: "Northwest" },
    "tay-nam": { vi: "Tây Nam", en: "Southwest" },
};

export const FURNISHING_LABEL: Record<Furnishing, Label> = {
    none: { vi: "Không nội thất", en: "Unfurnished" },
    basic: { vi: "Nội thất cơ bản", en: "Basic furnishing" },
    full: { vi: "Đầy đủ nội thất", en: "Fully furnished" },
};

export const LEGAL_LABEL: Record<LegalKind, Label> = {
    "so-do-so-hong": { vi: "Sổ đỏ / sổ hồng", en: "Red book / pink book" },
    "hop-dong-mua-ban": { vi: "Hợp đồng mua bán", en: "Sale contract" },
    "dang-cho-so": { vi: "Đang chờ cấp sổ", en: "Awaiting title" },
    khac: { vi: "Giấy tờ khác", en: "Other documents" },
};

export const ROLE_LABEL: Record<PosterRole, Label> = {
    owner: { vi: "Chủ nhà", en: "Owner" },
    agent: { vi: "Môi giới", en: "Agent" },
};
