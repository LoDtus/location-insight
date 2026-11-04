import { describe, expect, it } from "vitest";

import { detectImageType, fitWithin } from "@/features/properties/listing-photos";

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

describe("detectImageType", () => {
    it("nhận JPEG, PNG, WebP bằng chữ ký đầu tệp", () => {
        expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
        expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
        expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
    });

    it("từ chối tệp giả đuôi ảnh (HTML, SVG, GIF, rỗng)", () => {
        expect(detectImageType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
        expect(detectImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
        expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
        expect(detectImageType(bytes())).toBeNull();
    });

    it("RIFF nhưng không phải WebP (ví dụ WAV) bị từ chối", () => {
        expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45))).toBeNull();
    });
});

describe("fitWithin", () => {
    it("giữ nguyên ảnh nhỏ hơn giới hạn", () => {
        expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    });

    it("thu nhỏ theo cạnh dài, giữ tỉ lệ", () => {
        expect(fitWithin(2560, 1280, 1280)).toEqual({ width: 1280, height: 640 });
        expect(fitWithin(1000, 4000, 1280)).toEqual({ width: 320, height: 1280 });
    });

    it("không trả cạnh bằng 0", () => {
        expect(fitWithin(1, 100000, 1280).width).toBeGreaterThanOrEqual(1);
    });
});
