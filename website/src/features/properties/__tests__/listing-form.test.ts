import { describe, expect, it } from "vitest";

import {
    buildListing,
    completenessItems,
    composeLocation,
    describePrice,
    INITIAL_FORM,
    isVietnamMobile,
    parseDecimal,
    validateForm,
    type ListingForm,
} from "@/features/properties/listing-form";
import { EMPTY_RICH_TEXT } from "@/shared/components/editor/rich-text.utils";

const valid: ListingForm = {
    ...INITIAL_FORM,
    title: "Bán nhà mặt phố Hàng Bạc 60 m²",
    price: "4600000000",
    area: "60",
    district: "Hoàn Kiếm",
    ward: "phường Hoàn Kiếm",
    street: "Hàng Bạc",
    legalKind: "so-do-so-hong",
    contactName: "Nguyễn Văn A",
    phone: "0912 345 678",
    agreed: true,
};

describe("isVietnamMobile", () => {
    it("nhận số di động hợp lệ với khoảng trắng, dấu chấm và +84", () => {
        expect(isVietnamMobile("0912 345 678")).toBe(true);
        expect(isVietnamMobile("0912.345.678")).toBe(true);
        expect(isVietnamMobile("+84912345678")).toBe(true);
    });

    it("từ chối số sai độ dài, đầu số hoặc ký tự lạ", () => {
        expect(isVietnamMobile("091234567")).toBe(false);
        expect(isVietnamMobile("0212345678")).toBe(false);
        expect(isVietnamMobile("09123456789")).toBe(false);
        expect(isVietnamMobile("09123abc78")).toBe(false);
        expect(isVietnamMobile("")).toBe(false);
    });
});

describe("parseDecimal", () => {
    it("đọc dấu phẩy hoặc dấu chấm thập phân", () => {
        expect(parseDecimal("4,5")).toBe(4.5);
        expect(parseDecimal("4.5")).toBe(4.5);
        expect(parseDecimal(" 60 ")).toBe(60);
    });

    it("từ chối rỗng, số âm, ký tự lạ và nhiều dấu", () => {
        expect(parseDecimal("")).toBeNull();
        expect(parseDecimal("-5")).toBeNull();
        expect(parseDecimal("1e3")).toBeNull();
        expect(parseDecimal("1.2.3")).toBeNull();
    });
});

describe("describePrice", () => {
    it("đọc giá theo tỷ, triệu, đồng", () => {
        expect(describePrice(4_600_000_000, true)).toBe("4,6 tỷ");
        expect(describePrice(35_000_000, true)).toBe("35 triệu");
        expect(describePrice(500_000, true)).toContain("đồng");
        expect(describePrice(1_200_000_000, false)).toBe("1.2 billion");
    });

    it("trả chuỗi rỗng khi giá không hợp lệ", () => {
        expect(describePrice(0, true)).toBe("");
        expect(describePrice(Number.NaN, true)).toBe("");
    });
});

describe("validateForm", () => {
    it("form đầy đủ không có lỗi", () => {
        expect(validateForm(valid, 3, 120)).toEqual({});
    });

    it("form trống báo lỗi ở các trường bắt buộc", () => {
        const errors = validateForm(INITIAL_FORM, 0, 0);
        for (const key of ["title", "photos", "description", "price", "area", "district", "ward", "street", "legalKind", "contactName", "phone", "agreed"] as const) {
            expect(errors[key], key).toBeDefined();
        }
    });

    it("chặn quá 10 ảnh và mô tả quá dài", () => {
        const errors = validateForm(valid, 11, 3001);
        expect(errors.photos).toBeDefined();
        expect(errors.description).toBeDefined();
    });

    it("chỉ cho nhập tọa độ đủ cặp và nằm trong Hà Nội", () => {
        expect(validateForm({ ...valid, lat: "21.03" }, 1, 100).lat).toBeDefined();
        expect(validateForm({ ...valid, lat: "10.77", lng: "106.70" }, 1, 100).lat).toBeDefined();
        expect(validateForm({ ...valid, lat: "21,0340", lng: "105,8540" }, 1, 100).lat).toBeUndefined();
    });

    it("số tháng cọc chỉ bắt buộc hợp lệ khi cho thuê", () => {
        expect(validateForm({ ...valid, purpose: "ban", depositMonths: "99" }, 1, 100).depositMonths).toBeUndefined();
        expect(validateForm({ ...valid, purpose: "thue", depositMonths: "99" }, 1, 100).depositMonths).toBeDefined();
    });

    it("Zalo là tùy chọn nhưng nếu nhập phải đúng số di động", () => {
        expect(validateForm({ ...valid, zalo: "" }, 1, 100).zalo).toBeUndefined();
        expect(validateForm({ ...valid, zalo: "123" }, 1, 100).zalo).toBeDefined();
    });
});

describe("composeLocation", () => {
    it("ghép số nhà, đường và phường; ẩn số nhà khi được chọn", () => {
        const base = { street: "Hàng Bạc", ward: "phường Hoàn Kiếm", houseNumber: "12", hideHouseNumber: false };
        expect(composeLocation(base)).toBe("12 Hàng Bạc, phường Hoàn Kiếm");
        expect(composeLocation({ ...base, hideHouseNumber: true })).toBe("Hàng Bạc, phường Hoàn Kiếm");
    });
});

describe("buildListing", () => {
    const build = (form: ListingForm) =>
        buildListing({ form, photos: ["data:image/jpeg;base64,AAAA"], description: EMPTY_RICH_TEXT, id: "id-1", slug: "tin-1", today: "2026-11-04" });

    it("tạo tin khớp kiểu Listing và mang thông tin mở rộng", () => {
        const listing = build({ ...valid, houseNumber: "12", frontage: "4,5", floors: "3", direction: "dong-nam" });
        expect(listing).toMatchObject({
            id: "id-1",
            slug: "tin-1",
            location: "12 Hàng Bạc, phường Hoàn Kiếm",
            district: "Hoàn Kiếm",
            priceVnd: 4_600_000_000,
            areaM2: 60,
            updatedAt: "2026-11-04",
            watchers: 0,
        });
        expect(listing.extra?.frontageM).toBe(4.5);
        expect(listing.extra?.floors).toBe(3);
        expect(listing.extra?.direction).toBe("dong-nam");
        expect(listing.extra?.contact?.phone).toBe("0912345678");
        expect(listing.extra?.legal?.kind).toBe("so-do-so-hong");
    });

    it("tính ngày hết hạn từ thời hạn đã chọn", () => {
        expect(build({ ...valid, expiryDays: 30 }).extra?.expiresAt).toBe("2026-12-04");
    });

    it("bỏ số tháng cọc khi bán, giữ khi cho thuê", () => {
        expect(build({ ...valid, purpose: "ban", depositMonths: "2" }).extra?.depositMonths).toBeUndefined();
        expect(build({ ...valid, purpose: "thue", depositMonths: "2" }).extra?.depositMonths).toBe(2);
    });

    it("không để trường undefined lọt vào dữ liệu lưu", () => {
        const stored = JSON.stringify(build(valid).extra);
        expect(stored).not.toContain("undefined");
        expect(JSON.parse(stored)).not.toHaveProperty("frontageM");
    });
});

describe("completenessItems", () => {
    it("tính đúng từng mục hoàn thiện", () => {
        const empty = completenessItems(INITIAL_FORM, 0, 0);
        expect(empty.every((item) => !item.done)).toBe(true);
        const full = completenessItems({ ...valid, lat: "21.03", lng: "105.85", direction: "dong" }, 5, 200);
        expect(full.every((item) => item.done)).toBe(true);
    });
});
