import { describe, expect, it } from "vitest";

import { cellRing, classify, hasEvidence, planEvidence, withRoute } from "@/features/map/evidence-overlay";
import type { EvaluatedCriterion, MapRoute } from "@/features/map/map.types";

const origin = { lat: 21.03, lng: 105.85 };

function criterion(patch: Partial<EvaluatedCriterion>): EvaluatedCriterion {
    return {
        id: "truong-hoc",
        label: "Trường học",
        group: "walk",
        groupLabel: "Đi bộ",
        verdict: "Gần",
        detail: "Cách trường gần nhất 300 m",
        source: "OSM",
        score: 9,
        autoScore: 9,
        manual: false,
        skipped: false,
        weight: 3,
        defaultWeight: 3,
        status: "ok",
        confidence: "high",
        counted: true,
        note: null,
        blockingHit: false,
        evidence: [{ name: "Trường A", lat: 21.0327, lng: 105.85, distanceM: 300 }],
        method: "nearest@1",
        unit: "m",
        value: 300,
        cells: [],
        cellM: null,
        radiusM: 300,
        paths: [],
        zones: [],
        ...patch,
    };
}

describe("dẫn chứng trên bản đồ", () => {
    it("tiện ích gần nhất: cần đường đi thật, tạm nét đứt, vòng ngưỡng đạt trọn điểm, nhãn tên và khoảng cách", () => {
        const plan = planEvidence(criterion({}), origin);
        expect(plan?.routeTo).toEqual({ lat: 21.0327, lng: 105.85 });
        expect(plan?.overlay.lines[0].style).toBe("connector");
        expect(plan?.overlay.areas).toHaveLength(1);
        expect(plan?.overlay.points[0]).toMatchObject({ emphasis: "target", label: "Trường A · 300 m" });
        expect(plan?.overlay.caption).toMatch(/trường học gần nhất/);
        const [minLng, minLat, maxLng, maxLat] = plan?.overlay.bbox ?? [0, 0, 0, 0];
        expect(minLat).toBeLessThan(origin.lat);
        expect(maxLat).toBeGreaterThanOrEqual(21.0327);
        expect(maxLng).toBeGreaterThan(minLng);
    });

    it("thay nét đứt bằng tuyến thật khi có đường đi", () => {
        const plan = planEvidence(criterion({}), origin);
        const route = { distanceM: 420, durationS: 95, bbox: [105.849, 21.03, 105.851, 21.033], geometry: [[105.85, 21.03], [105.851, 21.031], [105.85, 21.0327]], steps: [], congestion: null } as MapRoute;
        const next = withRoute(plan!.overlay, route);
        expect(next.lines[0]).toMatchObject({ style: "route" });
        expect(next.lines[0].coordinates).toHaveLength(3);
        expect(next.caption).toMatch(/420 m, khoảng 2 phút xe máy/);
    });

    it("bệnh viện: ứng viên khác có nhãn phút; UBND giữ nguyên chữ viết tắt", () => {
        const plan = planEvidence(
            criterion({
                id: "benh-vien",
                method: "travel_time@1",
                detail: "9 phút đi xe máy tới bệnh viện gần nhất",
                evidence: [
                    { name: "BV A", lat: 21.04, lng: 105.85, distanceM: 1500, minutes: 9 },
                    { name: "BV B", lat: 21.02, lng: 105.83, distanceM: 2500, minutes: 14 },
                ],
            }),
            origin,
        );
        expect(plan?.overlay.points.map((point) => point.label)).toEqual(["① BV A · 1,5 km · 9 phút", "② BV B · 2,5 km · 14 phút"]);
        expect(plan?.overlay.points.map((point) => point.choice)).toEqual([0, 1]);
        expect(planEvidence(criterion({ id: "ubnd", label: "UBND" }), origin)?.overlay.caption).toMatch(/tới UBND gần nhất/);
    });

    it("quán ăn: vòng bán kính và chấm từng quán đậm theo khoảng cách, không gọi đường đi", () => {
        const plan = planEvidence(
            criterion({
                id: "quan-an",
                method: "count@1",
                radiusM: 500,
                evidence: [
                    { name: "Quán 1", lat: 21.0301, lng: 105.85, distanceM: 20 },
                    { name: "Quán 2", lat: 21.034, lng: 105.85, distanceM: 450 },
                ],
            }),
            origin,
        );
        expect(plan?.routeTo).toBeNull();
        expect(plan?.overlay.points[0].weight).toBeGreaterThan(plan?.overlay.points[1].weight ?? 1);
        expect(plan?.overlay.areas[0].outline).toBe(true);
    });

    it("lưới: tô từng ô theo 5 bậc, có chú giải, thêm viền bán kính", () => {
        const cells = [0, 100, 200, 300, 400].map((value, index) => ({ lat: 21.03 + index * 0.0009, lng: 105.85, value }));
        const plan = planEvidence(criterion({ id: "mat-do-dan-cu", method: "grid_sum@1", cells, cellM: 100, radiusM: 500, evidence: [] }), origin);
        expect(plan?.overlay.areas).toHaveLength(6);
        expect(new Set(plan?.overlay.areas.slice(0, 5).map((area) => area.color)).size).toBe(5);
        expect(plan?.overlay.legend).toHaveLength(5);
        const ring = cellRing({ lat: 21.03, lng: 105.85 }, 100);
        expect(ring).toHaveLength(5);
        expect((ring[2][1] - ring[0][1]) * 111320).toBeCloseTo(100, 0);
        expect(classify([5, 5]).index(5)).toBe(2);
    });

    it("không đo được hoặc tiêu chí AI chưa làm: không có dẫn chứng", () => {
        expect(hasEvidence(criterion({ status: "no_data", evidence: [] }))).toBe(false);
        expect(planEvidence(criterion({ status: "not_implemented", method: "ai_pending@0", evidence: [] }), origin)).toBeNull();
        expect(planEvidence(criterion({ method: "grid_mean@1", cells: [] }), origin)).toBeNull();
    });

    it("nhiều lựa chọn: bấm ② thì tuyến tới ②, chú thích so với ①", () => {
        const options = [
            { name: "Chợ A", lat: 21.032, lng: 105.85, distanceM: 220, minutes: 2 },
            { name: "Chợ B", lat: 21.035, lng: 105.852, distanceM: 560, minutes: 5 },
            { name: "Chợ C", lat: 21.025, lng: 105.845, distanceM: 760, minutes: 6 },
        ];
        const first = planEvidence(criterion({ id: "cho", label: "Chợ", evidence: options }), origin);
        expect(first?.routeTo).toEqual({ lat: 21.032, lng: 105.85 });
        expect(first?.overlay.points.map((point) => point.emphasis)).toEqual(["target", "other", "other"]);
        const second = planEvidence(criterion({ id: "cho", label: "Chợ", evidence: options }), origin, 1);
        expect(second?.routeTo).toEqual({ lat: 21.035, lng: 105.852 });
        expect(second?.overlay.selected).toBe(1);
        expect(second?.overlay.caption).toMatch(/Đang xem ② Chợ B: xa hơn ① 340 m, chậm hơn 3 phút/);
        const close = [options[0], { ...options[1], minutes: 2.4 }];
        expect(planEvidence(criterion({ id: "cho", label: "Chợ", evidence: close }), origin, 1)?.overlay.caption).toMatch(/thời gian đi tương đương/);
    });

    it("trường: nhãn ghi cấp học; hiệu thuốc chỉ ghim, không tuyến", () => {
        const plan = planEvidence(
            criterion({
                evidence: [
                    { name: "Hoa Sen", lat: 21.031, lng: 105.85, distanceM: 120, group: "Mầm non", minutes: 1 },
                    { name: "Tiểu học A", lat: 21.033, lng: 105.85, distanceM: 330, group: "Phổ thông", minutes: 3 },
                ],
            }),
            origin,
        );
        expect(plan?.overlay.points[0].label).toBe("① Mầm non · Hoa Sen · 120 m · 1 phút");
        const pharmacy = planEvidence(
            criterion({
                id: "hieu-thuoc",
                label: "Hiệu thuốc",
                evidence: [
                    { name: "A", lat: 21.031, lng: 105.85, distanceM: 100 },
                    { name: "B", lat: 21.032, lng: 105.85, distanceM: 210 },
                ],
            }),
            origin,
        );
        expect(pharmacy?.routeTo).toBeNull();
        expect(pharmacy?.overlay.lines).toEqual([]);
        expect(pharmacy?.overlay.points.every((point) => point.choice === null)).toBe(true);
    });

    it("ồn giao thông: tô đường trục và vùng ồn 80 m đậm hơn 300 m", () => {
        const ring: Array<[number, number]> = [
            [105.84, 21.02],
            [105.86, 21.02],
            [105.86, 21.04],
            [105.84, 21.02],
        ];
        const plan = planEvidence(
            criterion({
                id: "on-giao-thong",
                method: "line_nearest@1",
                radiusM: 600,
                evidence: [{ name: "Đường Láng", lat: 21.031, lng: 105.85, distanceM: 120 }],
                paths: [
                    [
                        [105.84, 21.031],
                        [105.86, 21.031],
                    ],
                ],
                zones: [
                    { meters: 80, rings: [ring] },
                    { meters: 300, rings: [ring] },
                ],
            }),
            origin,
        );
        expect(plan?.overlay.lines.map((line) => line.style)).toEqual(["road", "connector"]);
        const zones = plan?.overlay.areas.filter((area) => !area.outline) ?? [];
        expect(zones.map((area) => area.opacity)).toEqual([0.09, 0.22]);
        expect(plan?.overlay.legend).toHaveLength(2);
    });

    it("độ cao: tô theo chênh so với ô chứa địa điểm (thang hai chiều)", () => {
        const cells = [
            { lat: 21.03, lng: 105.85, value: 10 },
            { lat: 21.031, lng: 105.85, value: 12 },
            { lat: 21.029, lng: 105.85, value: 8 },
            { lat: 21.03, lng: 105.851, value: 10.2 },
        ];
        const plan = planEvidence(criterion({ id: "do-cao", method: "grid_relative@1", cells, cellM: 100, radiusM: 500, evidence: [] }), origin);
        const colors = plan?.overlay.areas.slice(0, 4).map((area) => area.color);
        expect(colors).toEqual(["#e5e7eb", "#8a5a1f", "#1d4ed8", "#e5e7eb"]);
        expect(plan?.overlay.legend?.[0][1]).toMatch(/thấp hơn/);
    });

    it("nội đô: vòng 3/10/20 km không kéo khung nhìn ra 20 km", () => {
        const plan = planEvidence(
            criterion({ id: "noi-do", method: "anchor@1", radiusM: null, evidence: [{ name: "Hồ Gươm", lat: 21.0285, lng: 105.852, distanceM: 1800, minutes: 6 }] }),
            origin,
        );
        expect(plan?.overlay.areas).toHaveLength(3);
        expect(plan?.overlay.areas.every((area) => area.fit === false)).toBe(true);
        const [minLng, , maxLng] = plan?.overlay.bbox ?? [0, 0, 0];
        expect(maxLng - minLng).toBeLessThan(0.01);
    });
});
