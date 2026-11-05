import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CRITERION_ICON, CRITERION_IDS } from "@/features/map/criteria-icons";

describe("criteria-icons", () => {
    it("đủ 19 tiêu chí cố định, mỗi tiêu chí một icon", () => {
        expect(CRITERION_IDS).toHaveLength(19);
        expect(Object.keys(CRITERION_ICON).sort()).toEqual([...CRITERION_IDS].sort());
    });

    it("khớp đúng bộ tiêu chí của backend (không thêm, không bớt)", () => {
        const source = readFileSync(resolve(__dirname, "../../../../../backend/src/modules/map/place-evaluation.ts"), "utf8");
        const backendIds = [...source.matchAll(/\{ id: '([a-z-]+)', label:/g)].map((match) => match[1]);
        expect(backendIds).toEqual([...CRITERION_IDS]);
    });
});
