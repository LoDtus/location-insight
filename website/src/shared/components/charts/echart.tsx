"use client";

import { BarChart, LineChart } from "echarts/charts";
import { AriaComponent, DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef, type JSX } from "react";

/**
 * Chỉ đăng ký phần ECharts dự án dùng (tree-shaking): thêm loại biểu đồ/thành phần mới ở đây khi cần.
 * Dùng SVGRenderer: nét sắc ở mọi mức zoom, nhẹ với lượng điểm vừa phải. Dữ liệu rất lớn thì đổi sang CanvasRenderer.
 */
echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, SVGRenderer]);

export type EChartOption = echarts.EChartsCoreOption;

/** Màu lấy từ token Tailwind (globals.css) để biểu đồ hợp theme; giá trị dự phòng khi chưa có CSS. */
export function chartToken(name: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Khung ECharts dùng chung: khởi tạo một lần, cập nhật option khi đổi (có animation chuyển tiếp), tự co giãn theo
 * khung chứa (ResizeObserver), giải phóng khi unmount. Tắt animation khi người dùng chọn giảm chuyển động.
 * Phần mô tả cho trình đọc màn hình (vd. bảng sr-only) do nơi dùng tự cung cấp; khung vẽ được ẩn khỏi cây truy cập.
 */
export default function EChart({ option, className, ariaHidden = true }: { option: EChartOption; className?: string; ariaHidden?: boolean }): JSX.Element {
    const hostRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const chart = echarts.init(host, null, { renderer: "svg", locale: "EN" });
        chartRef.current = chart;
        const observer = new ResizeObserver(() => chart.resize());
        observer.observe(host);
        return () => {
            observer.disconnect();
            chart.dispose();
            chartRef.current = null;
        };
    }, []);

    useEffect(() => {
        const reduced = prefersReducedMotion();
        chartRef.current?.setOption({ animation: !reduced, ...option }, { notMerge: true });
    }, [option]);

    return <div ref={hostRef} aria-hidden={ariaHidden || undefined} className={className} />;
}
