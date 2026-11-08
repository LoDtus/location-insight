"use client";

import { Button, DatePicker, Popover, Segmented } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/vi";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, type JSX } from "react";

import {
    axisTick,
    bucketLabel,
    FREQUENCY_PRESETS,
    resolveFrequency,
    selectionTitle,
    shiftSelection,
    tickInterval,
    vnToday,
    type FrequencySelection,
} from "@/features/articles/article-frequency";
import { listPublishedFrequency, type FrequencyGrain, type PublishedFrequency } from "@/features/articles/articles.api";
import { AuthApiError } from "@/features/auth/auth.api";
import EChart, { chartToken, type EChartOption } from "@/shared/components/charts/echart";

type PickerMode = "range" | "month" | "year";

const PICKER_MODES: { label: string; value: PickerMode }[] = [
    { label: "Khoảng ngày", value: "range" },
    { label: "Tháng", value: "month" },
    { label: "Năm", value: "year" },
];

const INK = "#101111";
const MUTED = "rgba(16,17,17,0.55)";
const SCHEDULED = "#2a78d6";

function FrequencyChart({ data }: { data: PublishedFrequency }): JSX.Element {
    const option = useMemo(() => {
        const green = chartToken("--color-green", "#026a4e");
        const { grain, points } = data;
        const hasScheduled = points.some((point) => point.scheduled > 0);
        const dense = points.length > 14;
        return ({ narrow }: { narrow: boolean }): EChartOption => ({
            textStyle: { fontFamily: "system-ui, -apple-system, sans-serif", color: INK },
            grid: { left: 4, right: 12, top: hasScheduled ? 36 : 16, bottom: 4, containLabel: true },
            legend: hasScheduled ? { top: 0, left: 0, itemWidth: 16, itemHeight: 8, textStyle: { color: INK } } : undefined,
            tooltip: {
                trigger: "axis",
                confine: true,
                axisPointer: { type: "line", lineStyle: { color: "rgba(16,17,17,0.35)" } },
                formatter: (params: { dataIndex: number }[]) => {
                    const point = points[params[0]?.dataIndex ?? -1];
                    if (!point) return "";
                    const scheduled = point.scheduled > 0 ? `<br/>Đã lên lịch: <b>${point.scheduled}</b> bài` : "";
                    return `${bucketLabel(grain, point.bucket)}<br/>Đã đăng: <b>${point.count}</b> bài${scheduled}`;
                },
            },
            xAxis: {
                type: "category",
                boundaryGap: false,
                data: points.map((point) => point.bucket),
                axisTick: { show: false },
                axisLine: { lineStyle: { color: "#d9d9d9" } },
                // Thưa nhãn: tối đa 6 nhãn (4 khi khung hẹp); mốc đang rê luôn hiện ở nhãn con trỏ dưới trục.
                axisLabel: {
                    color: MUTED,
                    interval: tickInterval(points.length, narrow ? 4 : 6),
                    formatter: (bucket: string) => axisTick(grain, bucket),
                    hideOverlap: true,
                    margin: 12,
                },
                axisPointer: {
                    show: true,
                    label: { show: true, formatter: ({ value }: { value: string }) => axisTick(grain, value), backgroundColor: INK, color: "#fff", padding: [4, 6], borderRadius: 4 },
                },
            },
            yAxis: { type: "value", minInterval: 1, splitNumber: 4, splitLine: { lineStyle: { color: "#efefef" } }, axisLabel: { color: MUTED } },
            series: [
                {
                    type: "line",
                    name: "Đã đăng",
                    data: points.map((point) => point.count),
                    // Cong nhẹ nhưng không vọt quá điểm dữ liệu (đếm số bài không có giá trị trung gian).
                    smooth: 0.3,
                    smoothMonotone: "x",
                    showSymbol: !dense,
                    symbol: "circle",
                    symbolSize: 7,
                    lineStyle: { color: green, width: 2 },
                    itemStyle: { color: green, borderColor: "#fff", borderWidth: 2 },
                    areaStyle: {
                        color: {
                            type: "linear",
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: "rgba(2,106,78,0.22)" },
                                { offset: 1, color: "rgba(2,106,78,0)" },
                            ],
                        },
                    },
                    emphasis: { focus: "none", scale: 1.4 },
                    animationDuration: 700,
                    animationEasing: "cubicOut",
                },
                ...(hasScheduled
                    ? [
                          {
                              type: "line",
                              name: "Đã lên lịch",
                              data: points.map((point) => point.scheduled),
                              showSymbol: !dense,
                              symbol: "rect",
                              symbolSize: 7,
                              lineStyle: { color: SCHEDULED, width: 2, type: "dashed" },
                              itemStyle: { color: SCHEDULED, borderColor: "#fff", borderWidth: 2 },
                          },
                      ]
                    : []),
            ],
        });
    }, [data]);
    return <EChart option={option} className="h-[280px] w-full" />;
}

/** Trạng thái tải gắn với khóa truy vấn: đổi khoảng thì kết quả cũ tự thành "đang tải", không cần setState trong effect. */
type Loaded = { key: string; data: PublishedFrequency | null; error: string };

/**
 * Khối "Số bài đã đăng" ở /admin/blogs: biểu đồ đường (ECharts) với mốc nhanh 30/60 ngày, nửa năm, 1 năm và bộ chọn
 * tự do (khoảng ngày, tháng, năm; tháng/năm có mũi tên lùi/tiến). Không chọn được ngày trong tương lai, trừ khi có bài
 * đặt lịch (máy chủ trả `latest`), khi đó đường "Đã lên lịch" hiện thêm.
 */
export default function ArticleFrequencyPanel({ reloadKey }: { reloadKey: number }): JSX.Element {
    const [selection, setSelection] = useState<FrequencySelection>({ kind: "preset", preset: "30d" });
    const [today] = useState(() => vnToday());
    const [latest, setLatest] = useState(today);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [mode, setMode] = useState<PickerMode>("range");
    const [loaded, setLoaded] = useState<Loaded | null>(null);

    const query = useMemo(() => resolveFrequency(selection, today, latest), [selection, today, latest]);
    const key = `${query.grain}|${query.from}|${query.to}|${reloadKey}`;

    useEffect(() => {
        let active = true;
        void listPublishedFrequency(query)
            .then((data) => {
                if (!active) return;
                setLoaded({ key, data, error: "" });
                if (data.latest && data.latest !== latest) setLatest(data.latest > today ? data.latest : today);
            })
            .catch((error: unknown) => {
                if (active) setLoaded({ key, data: null, error: error instanceof AuthApiError ? error.message : "Chưa tải được số bài đã đăng." });
            });
        return () => {
            active = false;
        };
    }, [key, query, latest, today]);

    const current = loaded?.key === key ? loaded : null;
    const data = current?.data ?? null;
    const future = (day: Dayjs): boolean => day.format("YYYY-MM-DD") > latest;
    const prev = shiftSelection(selection, -1, latest);
    const next = shiftSelection(selection, 1, latest);
    const unit: Record<FrequencyGrain, string> = { day: "ngày", month: "tháng", year: "năm" };
    const peak = data?.points.reduce((best, point) => (point.count > best.count ? point : best), data.points[0]);

    function choose(nextSelection: FrequencySelection): void {
        setSelection(nextSelection);
        setPickerOpen(false);
    }

    const picker = (
        <div className="flex w-[340px] max-w-[calc(100vw-48px)] flex-col gap-3">
            <Segmented<PickerMode> block options={PICKER_MODES} value={mode} onChange={setMode} />
            {mode === "range" ? (
                <DatePicker.RangePicker
                    format="DD/MM/YYYY"
                    allowClear={false}
                    disabledDate={future}
                    getPopupContainer={(node) => node.parentElement ?? document.body}
                    defaultValue={[dayjs(query.grain === "day" ? query.from : `${query.from}-01`), dayjs(query.grain === "day" ? query.to : `${query.to}-01`)]}
                    onChange={(values) => {
                        const [from, to] = values ?? [];
                        if (from && to) choose({ kind: "range", from: from.format("YYYY-MM-DD"), to: to.format("YYYY-MM-DD") });
                    }}
                />
            ) : null}
            {mode === "month" ? (
                <DatePicker
                    picker="month"
                    format="[Tháng] MM/YYYY"
                    allowClear={false}
                    disabledDate={(day) => day.format("YYYY-MM") > latest.slice(0, 7)}
                    getPopupContainer={(node) => node.parentElement ?? document.body}
                    defaultValue={dayjs(`${(selection.kind === "month" ? selection.month : today.slice(0, 7))}-01`)}
                    onChange={(value) => value && choose({ kind: "month", month: value.format("YYYY-MM") })}
                />
            ) : null}
            {mode === "year" ? (
                <DatePicker
                    picker="year"
                    format="[Năm] YYYY"
                    allowClear={false}
                    disabledDate={(day) => day.format("YYYY") > latest.slice(0, 4)}
                    getPopupContainer={(node) => node.parentElement ?? document.body}
                    defaultValue={dayjs(`${selection.kind === "year" ? selection.year : today.slice(0, 4)}-01-01`)}
                    onChange={(value) => value && choose({ kind: "year", year: value.format("YYYY") })}
                />
            ) : null}
            <p className="m-0 text-xs text-charcoal/60">Chọn tháng hoặc năm để dùng mũi tên lùi/tiến. Không xem được ngày trong tương lai.</p>
        </div>
    );

    return (
        <section aria-labelledby="article-frequency-title" className="flex flex-col gap-3 rounded-xl border border-charcoal/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="article-frequency-title" className="m-0 text-lg font-semibold">
                    Số bài đã đăng
                </h2>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <div role="group" aria-label="Khoảng thời gian nhanh" className="flex w-full rounded-lg bg-charcoal/5 p-1 sm:inline-flex sm:w-auto">
                        {FREQUENCY_PRESETS.map((preset) => {
                            const active = selection.kind === "preset" && selection.preset === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    title={preset.title}
                                    aria-pressed={active}
                                    onClick={() => setSelection({ kind: "preset", preset: preset.id })}
                                    className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md px-2 text-sm font-semibold whitespace-nowrap text-charcoal/70 sm:px-3 hover:text-charcoal aria-pressed:bg-white aria-pressed:text-charcoal aria-pressed:shadow-sm"
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                    <Popover trigger="click" placement="bottomRight" open={pickerOpen} onOpenChange={setPickerOpen} content={picker} title="Chọn thời gian">
                        <Button
                            size="large"
                            type={selection.kind === "preset" ? "default" : "primary"}
                            icon={<CalendarDays size={16} aria-hidden />}
                            aria-label="Chọn thời gian tùy ý"
                            title="Chọn khoảng ngày, tháng hoặc năm"
                        >
                            {selection.kind === "preset" ? "Tùy chọn" : selectionTitle(selection)}
                        </Button>
                    </Popover>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex items-center gap-1">
                    {selection.kind === "month" || selection.kind === "year" ? (
                        <button
                            type="button"
                            disabled={!prev}
                            onClick={() => prev && setSelection(prev)}
                            aria-label={selection.kind === "month" ? "Tháng trước" : "Năm trước"}
                            title={selection.kind === "month" ? "Tháng trước" : "Năm trước"}
                            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-charcoal/5 disabled:opacity-35"
                        >
                            <ChevronLeft size={18} aria-hidden />
                        </button>
                    ) : null}
                    <p className="m-0 text-sm font-semibold" aria-live="polite">
                        {selectionTitle(selection)}
                    </p>
                    {selection.kind === "month" || selection.kind === "year" ? (
                        <button
                            type="button"
                            disabled={!next}
                            onClick={() => next && setSelection(next)}
                            aria-label={selection.kind === "month" ? "Tháng sau" : "Năm sau"}
                            title={next ? (selection.kind === "month" ? "Tháng sau" : "Năm sau") : "Chưa tới thời gian này"}
                            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-charcoal/5 disabled:opacity-35"
                        >
                            <ChevronRight size={18} aria-hidden />
                        </button>
                    ) : null}
                </div>
                {data ? (
                    <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm text-charcoal/70">
                        <span>
                            Tổng <b className="text-charcoal tabular-nums">{data.total}</b> bài
                        </span>
                        {peak && peak.count > 0 ? (
                            <span>
                                Cao nhất <b className="text-charcoal tabular-nums">{peak.count}</b> bài ({axisTick(data.grain, peak.bucket)})
                            </span>
                        ) : null}
                        {data.scheduledTotal > 0 ? (
                            <span>
                                Đã lên lịch <b className="text-charcoal tabular-nums">{data.scheduledTotal}</b> bài
                            </span>
                        ) : null}
                        <span className="text-charcoal/50">Mỗi điểm là một {unit[data.grain]}</span>
                    </p>
                ) : null}
            </div>

            {current?.error ? (
                <p role="alert" className="m-0 text-sm">
                    {current.error}
                </p>
            ) : !data ? (
                <div aria-busy="true" className="h-[280px] w-full animate-pulse rounded-lg bg-charcoal/[0.04]" />
            ) : data.total === 0 && data.scheduledTotal === 0 ? (
                <p className="m-0 flex h-[120px] items-center justify-center rounded-lg bg-charcoal/[0.03] text-sm text-charcoal/60">Không có bài đã đăng trong khoảng này.</p>
            ) : (
                <div className="relative">
                    <FrequencyChart data={data} />
                    <table className="sr-only">
                        <caption>Số bài đã đăng theo {unit[data.grain]}</caption>
                        <thead>
                            <tr>
                                <th>Mốc</th>
                                <th>Đã đăng</th>
                                <th>Đã lên lịch</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.points.map((point) => (
                                <tr key={point.bucket}>
                                    <td>{bucketLabel(data.grain, point.bucket)}</td>
                                    <td>{point.count}</td>
                                    <td>{point.scheduled}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
