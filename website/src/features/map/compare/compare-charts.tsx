"use client";

import { ChartColumnBig, Radar } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import { formatScore } from "@/features/map/components/score-ring";
import { chartPlaces, type ChartPlace } from "@/features/map/compare/compare-chart";
import type { CompareTable } from "@/features/map/compare/compare-table";
import type { CompareItem, CriterionGroup } from "@/features/map/map.types";
import EChart, { type EChartOption } from "@/shared/components/charts/echart";

type View = "groups" | "radar";

const INK = "#101111";
const MUTED = "rgba(16,17,17,0.6)";
const GRID = "#ececec";
const FONT = "system-ui, -apple-system, sans-serif";

interface TooltipParam {
    seriesName: string;
    value: number | string | null;
    marker: string;
    axisValueLabel?: string;
}

/** Ngắt nhãn theo từ thành nhiều dòng ngắn (ECharts không tự xuống dòng tên trục radar). */
export function wrapLabel(label: string, max: number): string {
    const lines: string[] = [];
    for (const word of label.split(/\s+/)) {
        const last = lines.length - 1;
        if (last >= 0 && `${lines[last]} ${word}`.length <= max) lines[last] = `${lines[last]} ${word}`;
        else lines.push(word);
    }
    return lines.join("\n");
}

function scoreText(value: number | string | null | undefined): string {
    return typeof value === "number" ? `${formatScore(value)}/10` : "bỏ qua";
}

/** `narrow`: khung hẹp (điện thoại, hoặc /admin có sidebar): chữ nhỏ hơn để nhãn không chồng nhau. */
function groupsOption(places: ChartPlace[], table: CompareTable, narrow: boolean): EChartOption {
    const categories: Array<{ key: "overall" | CriterionGroup; label: string }> = [
        { key: "overall", label: "Điểm tổng" },
        // Nhóm AI chưa thực hiện chỉ có số minh họa: không vẽ.
        ...table.groups.filter((group) => group.group !== "ai").map((group) => ({ key: group.group, label: group.label })),
    ];
    return {
        textStyle: { fontFamily: FONT, color: INK },
        grid: { left: 4, right: 8, top: 12, bottom: 4, containLabel: true },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            confine: true,
            formatter: (params: TooltipParam[]) =>
                `<b>${params[0]?.axisValueLabel ?? ""}</b><br/>${params.map((param) => `${param.marker}${param.seriesName}: <b>${scoreText(param.value)}</b>`).join("<br/>")}`,
        },
        xAxis: {
            type: "category",
            data: categories.map((category) => category.label),
            axisTick: { show: false },
            axisLine: { lineStyle: { color: "#d9d9d9" } },
            axisLabel: { color: INK, fontWeight: 600, interval: 0, fontSize: narrow ? 10 : 12, width: narrow ? 52 : 96, overflow: "break" },
        },
        yAxis: { type: "value", min: 0, max: 10, interval: 2, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: MUTED } },
        series: places.map((place) => ({
            type: "bar",
            name: place.name,
            barMaxWidth: 28,
            barGap: narrow ? "8%" : "12%",
            itemStyle: { color: place.color, borderRadius: [4, 4, 0, 0] },
            data: categories.map((category) => (category.key === "overall" ? place.overall : (place.groups[category.key] ?? "-"))),
            animationDuration: 700,
            animationEasing: "cubicOut",
        })),
    };
}

function radarOption(places: ChartPlace[], items: readonly CompareItem[], table: CompareTable, narrow: boolean): EChartOption {
    const rows = table.groups.flatMap((group) => group.rows);
    const columnOf = new Map(items.map((item, index) => [item.id, index]));
    return {
        textStyle: { fontFamily: FONT, color: INK },
        tooltip: { trigger: "item", confine: true },
        radar: {
            center: ["50%", "50%"],
            radius: narrow ? "52%" : "70%",
            shape: "polygon",
            splitNumber: 5,
            indicator: rows.map((row) => ({ name: row.label, max: 10, min: 0 })),
            axisName: { color: INK, fontSize: narrow ? 9 : 11, lineHeight: narrow ? 11 : 14, formatter: (name?: string) => (narrow ? wrapLabel(name ?? "", 9) : (name ?? "")) },
            splitLine: { lineStyle: { color: GRID } },
            splitArea: { show: false },
            axisLine: { lineStyle: { color: GRID } },
        },
        series: [
            {
                type: "radar",
                emphasis: { focus: "series", lineStyle: { width: 3 } },
                animationDuration: 700,
                data: places.map((place) => {
                    const column = columnOf.get(place.id) ?? -1;
                    return {
                        name: place.name,
                        value: rows.map((row) => {
                            const cell = row.cells[column];
                            return cell && !cell.skipped ? cell.score : "-";
                        }),
                        symbol: place.symbol,
                        symbolSize: 7,
                        lineStyle: { color: place.color, width: 2 },
                        itemStyle: { color: place.color, borderColor: "#fff", borderWidth: 1 },
                        areaStyle: { color: place.color, opacity: 0.08 },
                    };
                }),
            },
        ],
    };
}

/** Ký hiệu nhỏ trong chú giải, khớp ký hiệu điểm của radar (không phân biệt chỉ bằng màu). */
function LegendMark({ place }: { place: ChartPlace }): JSX.Element {
    const shape =
        place.symbol === "circle"
            ? "rounded-full"
            : place.symbol === "diamond"
              ? "rotate-45 scale-75"
              : place.symbol === "triangle"
                ? "[clip-path:polygon(50%_0,100%_100%,0_100%)]"
                : "rounded-[3px]";
    return <span aria-hidden className={`inline-block size-3 shrink-0 ${shape}`} style={{ backgroundColor: place.color }} />;
}

/**
 * Biểu đồ so sánh (Apache ECharts) dưới bảng: "Theo nhóm" là cột điểm tổng và 4 nhóm tiêu chí; "Radar" trải 19 tiêu
 * chí. Mỗi địa điểm một màu cố định (theo địa điểm, không theo cột) và ký hiệu riêng. Chú giải là nút HTML (tự xuống
 * dòng, bấm để ẩn/hiện). Bảng phía trên là bản đọc được cho trình đọc màn hình, nên khung vẽ được ẩn khỏi cây truy cập.
 */
export default function CompareCharts({
    items,
    table,
    titleOf,
}: {
    items: readonly CompareItem[];
    table: CompareTable;
    titleOf: (item: CompareItem) => string;
}): JSX.Element {
    const [view, setView] = useState<View>("groups");
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const places = useMemo(() => chartPlaces(items, table, titleOf), [items, table, titleOf]);
    const shown = useMemo(() => places.filter((place) => !hidden.has(place.id)), [places, hidden]);
    const option = useMemo(
        () =>
            ({ narrow }: { narrow: boolean }): EChartOption =>
                view === "groups" ? groupsOption(shown, table, narrow) : radarOption(shown, items, table, narrow),
        [view, shown, items, table],
    );

    function toggle(id: string): void {
        setHidden((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const missing = items.length - places.length;
    const tabs: Array<{ id: View; label: string; icon: typeof Radar }> = [
        { id: "groups", label: "Theo nhóm", icon: ChartColumnBig },
        { id: "radar", label: "Radar", icon: Radar },
    ];

    return (
        <section aria-labelledby="compare-chart-title" className="mt-8 rounded-xl border border-charcoal/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 id="compare-chart-title" className="m-0 text-lg font-semibold">
                        Biểu đồ so sánh
                    </h2>
                    <p className="m-0 mt-0.5 text-sm text-charcoal/65">
                        {places.length === 0
                            ? "Đánh giá ít nhất một địa điểm để xem biểu đồ."
                            : `Thang 10 điểm. Rê chuột hoặc chạm để xem chi tiết.${missing > 0 ? ` ${missing} địa điểm chưa đánh giá không có trong biểu đồ.` : ""}`}
                    </p>
                </div>
                {places.length > 0 ? (
                    <div role="group" aria-label="Kiểu biểu đồ" className="flex w-full rounded-lg bg-charcoal/5 p-1 sm:inline-flex sm:w-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                aria-pressed={view === tab.id}
                                onClick={() => setView(tab.id)}
                                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap text-charcoal/70 hover:text-charcoal aria-pressed:bg-white aria-pressed:text-charcoal aria-pressed:shadow-sm"
                            >
                                <tab.icon size={15} aria-hidden /> {tab.label}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
            {places.length > 0 ? (
                <>
                    <ul aria-label="Địa điểm trên biểu đồ (bấm để ẩn/hiện)" className="m-0 mt-4 flex list-none flex-wrap gap-1.5 p-0">
                        {places.map((place) => {
                            const visible = !hidden.has(place.id);
                            return (
                                <li key={place.id} className="max-w-full min-w-0">
                                    <button
                                        type="button"
                                        aria-pressed={visible}
                                        onClick={() => toggle(place.id)}
                                        className={`inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border px-3 text-left text-sm hover:bg-charcoal/5 ${visible ? "border-charcoal/15 text-charcoal" : "border-dashed border-charcoal/20 text-charcoal/45 line-through"}`}
                                    >
                                        <LegendMark place={place} />
                                        <span className="min-w-0 truncate">{place.name}</span>
                                        <span className="shrink-0 font-semibold tabular-nums">{formatScore(place.overall)}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {shown.length > 0 ? (
                        <EChart option={option} className={`mt-3 w-full ${view === "radar" ? "h-[270px] sm:h-[500px]" : "h-[320px]"}`} />
                    ) : (
                        <p className="m-0 mt-6 mb-4 text-center text-sm text-charcoal/60">Đang ẩn hết địa điểm. Bấm một tên ở trên để hiện lại.</p>
                    )}
                </>
            ) : null}
        </section>
    );
}
