import { describe, expect, it } from "vitest";

import { formatPhone, telHref } from "@/features/properties/listing-contact";

describe("formatPhone", () => {
    it("nhóm số 4-3-3 và che ba số cuối khi cần", () => {
        expect(formatPhone("0912345678", false)).toBe("0912 345 678");
        expect(formatPhone("0912345678", true)).toBe("0912 345 ***");
    });

    it("đổi +84 về dạng 0", () => {
        expect(formatPhone("+84912345678", false)).toBe("0912 345 678");
    });

    it("số lạ không để lộ khi đang che", () => {
        expect(formatPhone("12345", true)).toBe("***");
    });
});

describe("telHref", () => {
    it("chỉ giữ số và dấu cộng, không cho chèn ký tự khác", () => {
        expect(telHref("0912 345 678")).toBe("tel:0912345678");
        expect(telHref("+84 912;345 678")).toBe("tel:+84912345678");
    });
});
