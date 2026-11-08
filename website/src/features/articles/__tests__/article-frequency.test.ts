import { describe, expect, it } from "vitest";

import { axisTick, bucketLabel, resolveFrequency, selectionTitle, shiftSelection, tickInterval, vnToday } from "@/features/articles/article-frequency";

const TODAY = "2026-11-08";

describe("khoảng thời gian biểu đồ số bài đã đăng", () => {
    it("mốc nhanh tính lùi từ hôm nay: 30/60 ngày theo ngày, nửa năm/1 năm theo tháng", () => {
        expect(resolveFrequency({ kind: "preset", preset: "30d" }, TODAY, TODAY)).toEqual({ grain: "day", from: "2026-10-10", to: TODAY });
        expect(resolveFrequency({ kind: "preset", preset: "60d" }, TODAY, TODAY)).toEqual({ grain: "day", from: "2026-09-10", to: TODAY });
        expect(resolveFrequency({ kind: "preset", preset: "6m" }, TODAY, TODAY)).toEqual({ grain: "month", from: "2026-06", to: "2026-11" });
        expect(resolveFrequency({ kind: "preset", preset: "1y" }, TODAY, TODAY)).toEqual({ grain: "month", from: "2025-12", to: "2026-11" });
    });

    it("tháng/năm đang diễn ra bị cắt ở ngày xa nhất được xem; có bài đặt lịch thì xem tới ngày đó", () => {
        expect(resolveFrequency({ kind: "month", month: "2026-11" }, TODAY, TODAY)).toEqual({ grain: "day", from: "2026-11-01", to: TODAY });
        expect(resolveFrequency({ kind: "month", month: "2026-11" }, TODAY, "2026-11-20").to).toBe("2026-11-20");
        expect(resolveFrequency({ kind: "month", month: "2024-02" }, TODAY, TODAY).to).toBe("2024-02-29");
        expect(resolveFrequency({ kind: "year", year: "2026" }, TODAY, TODAY)).toEqual({ grain: "month", from: "2026-01", to: "2026-11" });
    });

    it("khoảng ngày: cắt tương lai, khoảng dài gom theo tháng", () => {
        expect(resolveFrequency({ kind: "range", from: "2026-11-01", to: "2026-12-31" }, TODAY, TODAY)).toEqual({ grain: "day", from: "2026-11-01", to: TODAY });
        expect(resolveFrequency({ kind: "range", from: "2025-01-15", to: "2026-03-02" }, TODAY, TODAY)).toEqual({ grain: "month", from: "2025-01", to: "2026-03" });
    });

    it("mũi tên lùi/tiến không vượt qua tương lai", () => {
        expect(shiftSelection({ kind: "month", month: "2026-01" }, -1, TODAY)).toEqual({ kind: "month", month: "2025-12" });
        expect(shiftSelection({ kind: "month", month: "2026-11" }, 1, TODAY)).toBeNull();
        expect(shiftSelection({ kind: "month", month: "2026-11" }, 1, "2026-12-02")).toEqual({ kind: "month", month: "2026-12" });
        expect(shiftSelection({ kind: "year", year: "2026" }, 1, TODAY)).toBeNull();
        expect(shiftSelection({ kind: "preset", preset: "30d" }, -1, TODAY)).toBeNull();
    });

    it("nhãn mốc, tiêu đề và mật độ nhãn trục", () => {
        expect(bucketLabel("day", "2026-11-08")).toBe("Chủ nhật, 08/11/2026");
        expect(bucketLabel("month", "2026-11")).toBe("Tháng 11/2026");
        expect(axisTick("month", "2026-03")).toBe("T3/2026");
        expect(axisTick("day", "2026-11-08")).toBe("08/11");
        expect(selectionTitle({ kind: "range", from: "2026-09-01", to: "2026-10-15" })).toBe("01/09/2026 – 15/10/2026");
        expect(tickInterval(30, 6)).toBe(4);
        expect(tickInterval(6, 6)).toBe(0);
        expect(vnToday(new Date("2026-11-07T17:30:00Z"))).toBe("2026-11-08");
    });
});
