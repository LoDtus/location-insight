import { describe, expect, it } from "vitest";

import { resolveWorkerSwitch } from "@/features/pwa/pwa-client";

const base = { search: "", noSw: false, devSw: false };

// Hồi quy: ở dev, service worker cache-first phục vụ mãi chunk Next cũ (tên không mã băm),
// nên sửa mã không thấy hiệu lực. Ngoài production phải tắt worker mặc định.
describe("resolveWorkerSwitch", () => {
    it("ngoài production tắt worker mặc định", () => {
        expect(resolveWorkerSwitch({ ...base, production: false }).disabled).toBe(true);
    });

    it("production vẫn bật worker mặc định", () => {
        expect(resolveWorkerSwitch({ ...base, production: true }).disabled).toBe(false);
    });

    it("?sw=1 bật lại worker ở dev và được nhớ", () => {
        const first = resolveWorkerSwitch({ ...base, search: "?sw=1", production: false });
        expect(first).toEqual({ disabled: false, noSw: false, devSw: true });
        const later = resolveWorkerSwitch({ search: "", noSw: first.noSw, devSw: first.devSw, production: false });
        expect(later.disabled).toBe(false);
    });

    it("?no-sw=1 tắt worker ở mọi môi trường và được nhớ", () => {
        const first = resolveWorkerSwitch({ ...base, search: "?no-sw=1", production: true });
        expect(first.disabled).toBe(true);
        const later = resolveWorkerSwitch({ search: "", noSw: first.noSw, devSw: first.devSw, production: true });
        expect(later.disabled).toBe(true);
    });

    it("?no-sw=1 thắng ?sw=1 khi có cả hai", () => {
        expect(resolveWorkerSwitch({ ...base, search: "?sw=1&no-sw=1", production: false }).disabled).toBe(true);
    });
});
