import type { District, Listing, ListingKind, ListingPurpose } from "@/features/landing-page/data/listings";
import type { Direction, ExpiryDays, Furnishing, LegalKind, ListingExtra, PosterRole } from "@/features/properties/listing-extra";
import { MAX_PHOTOS } from "@/features/properties/listing-photos";
import type { RichTextDoc } from "@/shared/components/editor/rich-text.types";

export const TITLE_MIN = 10;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 30;
export const DESCRIPTION_MAX = 3000;

/** Hà Nội, theo phạm vi tin hiện có; dùng để chặn tọa độ nhập sai. */
export const HANOI_BOUNDS = { latMin: 20.5, latMax: 21.5, lngMin: 105.2, lngMax: 106.1 } as const;

export type ListingForm = {
    purpose: ListingPurpose;
    kind: ListingKind;
    title: string;
    price: string;
    negotiable: boolean;
    depositMonths: string;
    area: string;
    beds: string;
    living: string;
    baths: string;
    floors: string;
    direction: Direction | "";
    balconyDirection: Direction | "";
    frontage: string;
    roadWidth: string;
    furnishing: Furnishing | "";
    district: District | "";
    ward: string;
    street: string;
    houseNumber: string;
    hideHouseNumber: boolean;
    lat: string;
    lng: string;
    legalKind: LegalKind | "";
    legalNote: string;
    contactName: string;
    phone: string;
    role: PosterRole;
    zalo: string;
    hidePhone: boolean;
    expiryDays: ExpiryDays;
    agreed: boolean;
};

export type FormField = keyof ListingForm | "photos" | "description";
export type FieldError = { vi: string; en: string };
export type FormErrors = Partial<Record<FormField, FieldError>>;

export const INITIAL_FORM: ListingForm = {
    purpose: "ban",
    kind: "can-ho",
    title: "",
    price: "",
    negotiable: false,
    depositMonths: "",
    area: "",
    beds: "0",
    living: "0",
    baths: "0",
    floors: "",
    direction: "",
    balconyDirection: "",
    frontage: "",
    roadWidth: "",
    furnishing: "",
    district: "",
    ward: "",
    street: "",
    houseNumber: "",
    hideHouseNumber: false,
    lat: "",
    lng: "",
    legalKind: "",
    legalNote: "",
    contactName: "",
    phone: "",
    role: "owner",
    zalo: "",
    hidePhone: true,
    expiryDays: 30,
    agreed: false,
};

export function digitsOnly(value: string): string {
    return value.replace(/\D/g, "");
}

/** Chấp nhận số có dấu chấm hoặc phẩy thập phân, ví dụ "4,5" hoặc "4.5". */
export function parseDecimal(value: string): number | null {
    const normalized = value.trim().replace(",", ".");
    if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePhone(value: string): string {
    return value.replace(/[\s.\-()]/g, "");
}

/** Số di động Việt Nam: 0 hoặc +84, rồi đầu số 3, 5, 7, 8, 9 và 8 chữ số. */
export function isVietnamMobile(value: string): boolean {
    return /^(?:0|\+84)[35789]\d{8}$/.test(normalizePhone(value));
}

export function describePrice(priceVnd: number, vi: boolean): string {
    if (!Number.isFinite(priceVnd) || priceVnd <= 0) return "";
    const trim = (value: number): string => String(Math.round(value * 100) / 100).replace(".", vi ? "," : ".");
    if (priceVnd >= 1_000_000_000) return `${trim(priceVnd / 1_000_000_000)} ${vi ? "tỷ" : "billion"}`;
    if (priceVnd >= 1_000_000) return `${trim(priceVnd / 1_000_000)} ${vi ? "triệu" : "million"}`;
    return `${priceVnd.toLocaleString(vi ? "vi-VN" : "en-US")} ${vi ? "đồng" : "VND"}`;
}

function intInRange(value: string, min: number, max: number): boolean {
    if (value.trim() === "") return true;
    return /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
}

function optionalDecimalInRange(value: string, max: number): boolean {
    if (value.trim() === "") return true;
    const parsed = parseDecimal(value);
    return parsed !== null && parsed > 0 && parsed <= max;
}

export function validateForm(form: ListingForm, photoCount: number, descriptionChars: number): FormErrors {
    const errors: FormErrors = {};
    const title = form.title.trim();
    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
        errors.title = {
            vi: `Tiêu đề cần từ ${TITLE_MIN} đến ${TITLE_MAX} ký tự.`,
            en: `The title needs ${TITLE_MIN} to ${TITLE_MAX} characters.`,
        };
    }
    if (photoCount < 1 || photoCount > MAX_PHOTOS) {
        errors.photos = {
            vi: `Cần ít nhất 1 ảnh, tối đa ${MAX_PHOTOS} ảnh. Ảnh đầu tiên là ảnh bìa.`,
            en: `Add at least 1 photo, up to ${MAX_PHOTOS}. The first photo is the cover.`,
        };
    }
    if (descriptionChars < DESCRIPTION_MIN || descriptionChars > DESCRIPTION_MAX) {
        errors.description = {
            vi: `Mô tả cần từ ${DESCRIPTION_MIN} đến ${DESCRIPTION_MAX} ký tự.`,
            en: `The description needs ${DESCRIPTION_MIN} to ${DESCRIPTION_MAX} characters.`,
        };
    }
    const price = Number(form.price);
    if (!form.price || !Number.isFinite(price) || price <= 0 || price > 10_000_000_000_000) {
        errors.price = { vi: "Nhập giá lớn hơn 0.", en: "Enter a price above 0." };
    }
    const area = parseDecimal(form.area);
    if (area === null || area <= 0 || area > 1_000_000) {
        errors.area = { vi: "Nhập diện tích lớn hơn 0.", en: "Enter an area above 0." };
    }
    for (const field of ["beds", "living", "baths", "floors"] as const) {
        if (!intInRange(form[field], 0, 99)) {
            errors[field] = { vi: "Nhập số nguyên từ 0 đến 99.", en: "Enter a whole number from 0 to 99." };
        }
    }
    if (form.purpose === "thue" && !intInRange(form.depositMonths, 0, 24)) {
        errors.depositMonths = { vi: "Số tháng cọc từ 0 đến 24.", en: "Deposit months from 0 to 24." };
    }
    for (const field of ["frontage", "roadWidth"] as const) {
        if (!optionalDecimalInRange(form[field], 1000)) {
            errors[field] = { vi: "Nhập số mét lớn hơn 0.", en: "Enter metres above 0." };
        }
    }
    if (!form.district) errors.district = { vi: "Chọn quận hoặc huyện.", en: "Choose a district." };
    if (form.ward.trim().length < 2) errors.ward = { vi: "Nhập phường hoặc xã.", en: "Enter a ward or commune." };
    if (form.street.trim().length < 2) errors.street = { vi: "Nhập tên đường hoặc phố.", en: "Enter a street name." };
    const hasLat = form.lat.trim() !== "";
    const hasLng = form.lng.trim() !== "";
    if (hasLat !== hasLng) {
        errors.lat = { vi: "Nhập đủ cả vĩ độ và kinh độ.", en: "Enter both latitude and longitude." };
    } else if (hasLat) {
        const lat = Number(form.lat.replace(",", "."));
        const lng = Number(form.lng.replace(",", "."));
        const inside =
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= HANOI_BOUNDS.latMin &&
            lat <= HANOI_BOUNDS.latMax &&
            lng >= HANOI_BOUNDS.lngMin &&
            lng <= HANOI_BOUNDS.lngMax;
        if (!inside) {
            errors.lat = { vi: "Tọa độ nằm ngoài khu vực Hà Nội.", en: "The coordinates are outside Hanoi." };
        }
    }
    if (!form.legalKind) errors.legalKind = { vi: "Chọn tình trạng pháp lý.", en: "Choose the legal status." };
    if (form.contactName.trim().length < 2) errors.contactName = { vi: "Nhập tên người đăng.", en: "Enter the poster's name." };
    if (!isVietnamMobile(form.phone)) {
        errors.phone = { vi: "Nhập số di động Việt Nam hợp lệ.", en: "Enter a valid Vietnamese mobile number." };
    }
    if (form.zalo.trim() !== "" && !isVietnamMobile(form.zalo)) {
        errors.zalo = { vi: "Số Zalo cần là số di động hợp lệ.", en: "The Zalo number must be a valid mobile number." };
    }
    if (!form.agreed) errors.agreed = { vi: "Hãy đồng ý chính sách đăng tin.", en: "Accept the posting policy." };
    return errors;
}

function optionalInt(value: string): number | undefined {
    return value.trim() === "" ? undefined : Number(value);
}

function optionalDecimal(value: string): number | undefined {
    const parsed = parseDecimal(value);
    return parsed === null ? undefined : parsed;
}

export function composeLocation(form: Pick<ListingForm, "street" | "ward" | "houseNumber" | "hideHouseNumber">): string {
    const house = form.hideHouseNumber ? "" : form.houseNumber.trim();
    const street = [house, form.street.trim()].filter(Boolean).join(" ");
    return `${street}, ${form.ward.trim()}`;
}

function addDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00+07:00`);
    date.setUTCDate(date.getUTCDate() + days);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

export function buildListing(input: {
    form: ListingForm;
    photos: readonly string[];
    description: RichTextDoc;
    id: string;
    slug: string;
    today: string;
}): Listing {
    const { form, photos, description, id, slug, today } = input;
    const lat = form.lat.trim() === "" ? undefined : Number(form.lat.replace(",", "."));
    const lng = form.lng.trim() === "" ? undefined : Number(form.lng.replace(",", "."));
    const extra: ListingExtra = {
        description,
        negotiable: form.negotiable,
        depositMonths: form.purpose === "thue" ? optionalInt(form.depositMonths) : undefined,
        floors: optionalInt(form.floors),
        direction: form.direction || undefined,
        balconyDirection: form.balconyDirection || undefined,
        frontageM: optionalDecimal(form.frontage),
        roadWidthM: optionalDecimal(form.roadWidth),
        furnishing: form.furnishing || undefined,
        address: {
            ward: form.ward.trim(),
            street: form.street.trim(),
            houseNumber: form.houseNumber.trim() || undefined,
            hideHouseNumber: form.hideHouseNumber,
        },
        lat,
        lng,
        legal: form.legalKind ? { kind: form.legalKind, note: form.legalNote.trim() || undefined } : undefined,
        contact: {
            name: form.contactName.trim(),
            phone: normalizePhone(form.phone),
            role: form.role,
            zalo: form.zalo.trim() ? normalizePhone(form.zalo) : undefined,
            hidePhone: form.hidePhone,
        },
        expiresAt: addDays(today, form.expiryDays),
    };
    return {
        id,
        slug,
        title: form.title.trim(),
        location: composeLocation(form),
        district: form.district as District,
        purpose: form.purpose,
        kind: form.kind,
        priceVnd: Math.round(Number(form.price)),
        areaM2: Math.round(parseDecimal(form.area) ?? 0),
        beds: Number(form.beds) || 0,
        living: Number(form.living) || 0,
        baths: Number(form.baths) || 0,
        updatedAt: today,
        images: [...photos],
        watchers: 0,
        extra: JSON.parse(JSON.stringify(extra)) as ListingExtra,
    };
}

export type CompletenessItem = { key: string; vi: string; en: string; done: boolean };

/** Điểm hoàn thiện kiểu "chất lượng tin" của sàn thương mại điện tử: gợi ý người đăng bổ sung. */
export function completenessItems(form: ListingForm, photoCount: number, descriptionChars: number): CompletenessItem[] {
    const hasCoordinates = form.lat.trim() !== "" && form.lng.trim() !== "";
    return [
        { key: "title", vi: "Tiêu đề rõ ràng", en: "Clear title", done: form.title.trim().length >= TITLE_MIN },
        { key: "photos", vi: "Có ít nhất 5 ảnh", en: "At least 5 photos", done: photoCount >= 5 },
        { key: "description", vi: "Mô tả từ 200 ký tự", en: "Description of 200+ characters", done: descriptionChars >= 200 },
        { key: "price", vi: "Có giá và diện tích", en: "Price and area given", done: Number(form.price) > 0 && parseDecimal(form.area) !== null },
        { key: "address", vi: "Có địa chỉ đến đường", en: "Address down to the street", done: form.district !== "" && form.street.trim().length >= 2 && form.ward.trim().length >= 2 },
        { key: "coordinates", vi: "Có tọa độ trên bản đồ", en: "Map coordinates", done: hasCoordinates },
        { key: "legal", vi: "Khai pháp lý", en: "Legal status given", done: form.legalKind !== "" },
        { key: "details", vi: "Có hướng nhà hoặc số tầng", en: "Direction or floors given", done: form.direction !== "" || form.floors.trim() !== "" },
    ];
}
