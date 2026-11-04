import type { RichTextDoc } from "@/shared/components/editor/rich-text.types";

export const DIRECTIONS = ["dong", "tay", "nam", "bac", "dong-bac", "dong-nam", "tay-bac", "tay-nam"] as const;
export const FURNISHINGS = ["none", "basic", "full"] as const;
export const LEGAL_KINDS = ["so-do-so-hong", "hop-dong-mua-ban", "dang-cho-so", "khac"] as const;
export const POSTER_ROLES = ["owner", "agent"] as const;
export const EXPIRY_DAYS = [15, 30, 60, 90] as const;

export type Direction = (typeof DIRECTIONS)[number];
export type Furnishing = (typeof FURNISHINGS)[number];
export type LegalKind = (typeof LEGAL_KINDS)[number];
export type PosterRole = (typeof POSTER_ROLES)[number];
export type ExpiryDays = (typeof EXPIRY_DAYS)[number];

/** Thông tin mở rộng của tin rao. Mọi trường đều tùy chọn để tin cũ vẫn hợp lệ. */
export type ListingExtra = {
    description?: RichTextDoc;
    negotiable?: boolean;
    /** Chỉ cho tin cho thuê: số tháng đặt cọc. */
    depositMonths?: number;
    floors?: number;
    direction?: Direction;
    balconyDirection?: Direction;
    frontageM?: number;
    roadWidthM?: number;
    furnishing?: Furnishing;
    address?: {
        ward: string;
        street: string;
        houseNumber?: string;
        hideHouseNumber?: boolean;
    };
    lat?: number;
    lng?: number;
    legal?: { kind: LegalKind; note?: string };
    contact?: {
        name: string;
        phone: string;
        role: PosterRole;
        zalo?: string;
        hidePhone: boolean;
    };
    expiresAt?: string;
};
