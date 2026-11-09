import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CRITERION_ICON, CRITERION_IDS } from "@/features/map/criteria-icons";

describe("criteria-icons", () => {
    it("đủ 22 tiêu chí cố định (19 đo tự động, 3 cần AI chưa làm), mỗi tiêu chí một icon", () => {
        expect(CRITERION_IDS).toHaveLength(22);
        expect(Object.keys(CRITERION_ICON).sort()).toEqual([...CRITERION_IDS].sort());
    });

    it("khớp đúng bộ tiêu chí của backend (không thêm, không bớt)", () => {
        const source = readFileSync(resolve(__dirname, "../../../../../backend/src/modules/map/criteria.ts"), "utf8");
        const list = source.slice(source.indexOf("export const CRITERIA"), source.indexOf("export const CRITERION_IDS"));
        // Tiêu chí khai bằng near('id', …), aiPending('id', …) hoặc object { id: 'id', label: … }.
        const backendIds = [...list.matchAll(/(?:near|aiPending)\('([a-z-]+)'|\bid: '([a-z-]+)',\s+label:/g)].map((match) => match[1] ?? match[2]);
        expect(backendIds).toEqual([...CRITERION_IDS]);
    });
});
