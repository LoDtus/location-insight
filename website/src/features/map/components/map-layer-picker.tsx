"use client";

import { ChevronDown, House, Layers, MapPinned, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { OTHER_AMENITIES, POI_CATEGORIES, POI_STYLE, type OverlayId, type PoiCategory } from "@/features/map/map-overlays";
import type { MapStyleId } from "@/features/map/map.types";

const BASE_LAYERS: Array<{ id: MapStyleId; label: string; swatch: string }> = [
    { id: "tm", label: "Đường phố", swatch: "linear-gradient(135deg,#e8efe3,#f6e9b8)" },
    { id: "lm", label: "Sáng", swatch: "linear-gradient(135deg,#f5f5f5,#dcdcdc)" },
    { id: "dm", label: "Tối", swatch: "linear-gradient(135deg,#2b2f36,#11141a)" },
    { id: "hm", label: "Vệ tinh", swatch: "linear-gradient(135deg,#3d5a3a,#1f3a4d)" },
];

const LAYER_CLOSE_DELAY_MS = 2000;

interface MapLayerPickerProps {
    styleId: MapStyleId;
    onStyleChange: (id: MapStyleId) => void;
    trafficAvailable: boolean;
    trafficOn: boolean;
    onTrafficChange: (on: boolean) => void;
    /** Lớp hiển thị đang bật. */
    overlays: readonly OverlayId[];
    onOverlaysChange: (next: OverlayId[]) => void;
    /** Số tin rao đang có trên bản đồ (để hiện cạnh công tắc). */
    listingCount: number;
    /** Vừa bật một lớp từ bảng "Tiện ích": màn hình phóng bản đồ tới mức thấy được điểm. */
    onOverlayEnabled?: () => void;
}

/** Thứ tự trong bảng bật nhanh: hay dùng trước. */
const QUICK_ORDER: readonly PoiCategory[] = ["bank", "food", "school", "bus", "metro", "hospital", "pharmacy", "market", "supermarket", "park", "townhall", "hardware"];

function Switch({ on, label }: { on: boolean; label?: string }): ReactNode {
    return (
        <span
            aria-hidden={label ? undefined : true}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none ${on ? "bg-green" : "bg-charcoal/20"}`}
        >
            <span className={`absolute size-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </span>
    );
}

function Dot({ color }: { color: string }): ReactNode {
    return <span aria-hidden className="inline-block size-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: color, boxShadow: `0 0 0 1px ${color}40` }} />;
}

export default function MapLayerPicker({
    styleId,
    onStyleChange,
    trafficAvailable,
    trafficOn,
    onTrafficChange,
    overlays,
    onOverlaysChange,
    listingCount,
    onOverlayEnabled,
}: MapLayerPickerProps) {
    const [open, setOpen] = useState(false);
    const [quickOpen, setQuickOpen] = useState(false);
    const quickId = useId();
    const [othersOpen, setOthersOpen] = useState(false);
    const othersId = useId();
    const enabled = new Set(overlays);
    const otherCount = OTHER_AMENITIES.filter((id) => enabled.has(id)).length;
    const activeCount = overlays.length;

    function setOverlay(id: OverlayId, on: boolean): void {
        const next = new Set(overlays);
        if (on) next.add(id);
        else next.delete(id);
        onOverlaysChange([...next]);
    }

    function toggleQuick(id: OverlayId): void {
        const on = !enabled.has(id);
        setOverlay(id, on);
        if (on) onOverlayEnabled?.();
    }

    function setOthers(on: boolean): void {
        const next = new Set(overlays);
        for (const id of OTHER_AMENITIES) {
            if (on) next.add(id);
            else next.delete(id);
        }
        onOverlaysChange([...next]);
    }
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const current = BASE_LAYERS.find((layer) => layer.id === styleId) ?? BASE_LAYERS[0];

    function clearCloseTimer(): void {
        if (closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }

    function scheduleClose(): void {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
            setOpen(false);
            closeTimerRef.current = null;
        }, LAYER_CLOSE_DELAY_MS);
    }

    useEffect(() => clearCloseTimer, []);

    const row =
        "flex min-h-10 w-full items-center gap-3 rounded-md bg-transparent px-2 text-left text-sm text-charcoal hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green";

    function overlayRow(id: OverlayId, label: string, marker: ReactNode, extra?: ReactNode): ReactNode {
        const on = enabled.has(id);
        return (
            <button type="button" role="switch" aria-checked={on} onClick={() => setOverlay(id, !on)} className={row}>
                {marker}
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {extra}
                <Switch on={on} />
            </button>
        );
    }

    return (
        <div
            className="pointer-events-auto absolute bottom-2 left-2 z-10 flex items-end gap-2"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    setOpen(false);
                    setQuickOpen(false);
                }
            }}
        >
            <div className="flex flex-col items-start gap-2">
                <button
                    type="button"
                    aria-pressed={enabled.has("listing")}
                    onClick={() => setOverlay("listing", !enabled.has("listing"))}
                    title={enabled.has("listing") ? "Ẩn tin đang rao" : "Hiện tin đang rao trên bản đồ"}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-md ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${enabled.has("listing") ? "bg-green text-cream ring-green" : "bg-white text-charcoal ring-charcoal/15 hover:bg-[#f4f4f4]"}`}
                >
                    <House size={14} aria-hidden /> Tin rao
                </button>
                <button
                    type="button"
                    aria-expanded={quickOpen}
                    aria-controls={quickId}
                    onClick={() => {
                        setOpen(false);
                        setQuickOpen((value) => !value);
                    }}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-md ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${quickOpen ? "bg-white text-green ring-2 ring-green" : "bg-white text-charcoal ring-charcoal/15 hover:bg-[#f4f4f4]"}`}
                >
                    <MapPinned size={14} aria-hidden /> Tiện ích
                    {POI_CATEGORIES.some((id) => enabled.has(id)) ? (
                        <span className="min-w-4 rounded-full bg-green px-1 text-center text-[10px] leading-4 text-cream tabular-nums">
                            {POI_CATEGORIES.filter((id) => enabled.has(id)).length}
                        </span>
                    ) : null}
                </button>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="true"
                    aria-label={activeCount > 0 ? `Lớp bản đồ (${activeCount} lớp hiển thị đang bật)` : "Lớp bản đồ"}
                    onClick={() => {
                        setQuickOpen(false);
                        setOpen((value) => !value);
                    }}
                    className="relative size-14 shrink-0 rounded-lg border-2 border-white shadow-md"
                    style={{ background: current.swatch }}
                >
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 rounded-b-md bg-black/55 py-0.5 text-[10px] text-white">
                        <Layers size={12} strokeWidth={2} aria-hidden />
                        Lớp
                    </span>
                    {activeCount > 0 ? (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] rounded-full bg-green px-1 text-center text-[10px] leading-[18px] font-semibold text-cream tabular-nums ring-2 ring-white">
                            {activeCount}
                        </span>
                    ) : null}
                </button>
            </div>
            {quickOpen ? (
                <section
                    id={quickId}
                    aria-label="Hiện điểm trên bản đồ"
                    className="w-[min(calc(100vw-7rem),20rem)] rounded-xl bg-white p-3 shadow-lg ring-1 ring-charcoal/10"
                >
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="m-0 text-sm font-semibold">Hiện trên bản đồ</p>
                        <button
                            type="button"
                            aria-label="Đóng"
                            onClick={() => setQuickOpen(false)}
                            className="inline-flex size-7 items-center justify-center rounded-md bg-transparent text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal"
                        >
                            <X size={15} aria-hidden />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {(["listing", ...QUICK_ORDER] as OverlayId[]).map((id) => {
                            const on = enabled.has(id);
                            const label = id === "listing" ? "Đang rao bán" : POI_STYLE[id as PoiCategory].label;
                            const color = id === "listing" ? "#026a4e" : POI_STYLE[id as PoiCategory].color;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleQuick(id)}
                                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ring-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green ${on ? "bg-charcoal text-white ring-charcoal" : "bg-white text-charcoal/80 ring-charcoal/15 hover:bg-charcoal/5"}`}
                                >
                                    <span aria-hidden className="size-2.5 rounded-full ring-2 ring-white/80" style={{ background: color }} />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="m-0 mt-2 text-[11px] leading-snug text-charcoal/55">Bật một loại thì bản đồ phóng tới mức 13 ngay tại chỗ (nếu đang xa hơn).</p>
                </section>
            ) : null}
            {open ? (
                <div
                    role="group"
                    aria-label="Lớp bản đồ"
                    className="flex max-h-[min(70vh,34rem)] w-[min(calc(100vw-6rem),21rem)] flex-col overflow-y-auto rounded-xl bg-white p-3 shadow-lg ring-1 ring-charcoal/10 [scrollbar-width:thin]"
                >
                    <p className="m-0 mb-2 text-xs font-semibold text-charcoal/60">Kiểu bản đồ</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {BASE_LAYERS.map((layer) => (
                            <button
                                key={layer.id}
                                type="button"
                                aria-pressed={layer.id === styleId}
                                className="flex w-14 shrink-0 flex-col items-center gap-1 text-center"
                                onClick={() => onStyleChange(layer.id)}
                            >
                                <span
                                    className={`block size-12 rounded-lg border-2 ${layer.id === styleId ? "border-green" : "border-transparent ring-1 ring-charcoal/15"}`}
                                    style={{ background: layer.swatch }}
                                />
                                <span className="text-[11px] leading-tight text-neutral-700">{layer.label}</span>
                            </button>
                        ))}
                        {trafficAvailable ? (
                            <button
                                type="button"
                                aria-pressed={trafficOn}
                                className="flex w-14 shrink-0 flex-col items-center gap-1 text-center"
                                onClick={() => onTrafficChange(!trafficOn)}
                            >
                                <span
                                    className={`block size-12 rounded-lg border-2 ${trafficOn ? "border-green" : "border-transparent ring-1 ring-charcoal/15"}`}
                                    style={{ background: "linear-gradient(135deg,#1a9850,#f2b705 50%,#c0392b)" }}
                                />
                                <span className="text-[11px] leading-tight text-neutral-700">Giao thông</span>
                            </button>
                        ) : null}
                    </div>

                    <div role="presentation" className="my-2.5 h-px bg-charcoal/10" />
                    <p className="m-0 mb-1 text-xs font-semibold text-charcoal/60">Hiển thị trên bản đồ</p>
                    {overlayRow(
                        "listing",
                        "Tin đang rao",
                        <span aria-hidden className="inline-flex h-4 shrink-0 items-center rounded-full bg-green px-1.5 text-[9px] font-bold text-cream">
                            tỷ
                        </span>,
                        <span className="text-xs text-charcoal/50 tabular-nums">{listingCount}</span>,
                    )}
                    {overlayRow("school", POI_STYLE.school.label, <Dot color={POI_STYLE.school.color} />)}
                    {overlayRow("bank", POI_STYLE.bank.label, <Dot color={POI_STYLE.bank.color} />)}
                    <div className="flex items-center">
                        <button
                            type="button"
                            role="switch"
                            aria-checked={otherCount === OTHER_AMENITIES.length ? true : otherCount > 0 ? "mixed" : false}
                            onClick={() => setOthers(otherCount < OTHER_AMENITIES.length)}
                            className={`${row} flex-1`}
                        >
                            <span aria-hidden className="flex shrink-0 -space-x-1">
                                {OTHER_AMENITIES.slice(0, 3).map((id) => (
                                    <Dot key={id} color={POI_STYLE[id].color} />
                                ))}
                            </span>
                            <span className="min-w-0 flex-1 truncate">Tiện ích khác</span>
                            {otherCount > 0 && otherCount < OTHER_AMENITIES.length ? (
                                <span className="text-xs text-charcoal/50 tabular-nums">
                                    {otherCount}/{OTHER_AMENITIES.length}
                                </span>
                            ) : null}
                            <Switch on={otherCount > 0} />
                        </button>
                        <button
                            type="button"
                            aria-expanded={othersOpen}
                            aria-controls={othersId}
                            aria-label={othersOpen ? "Thu gọn danh sách tiện ích" : "Chọn từng loại tiện ích"}
                            onClick={() => setOthersOpen((value) => !value)}
                            className="ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-transparent text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal"
                        >
                            <ChevronDown size={16} aria-hidden className={`transition-transform motion-reduce:transition-none ${othersOpen ? "rotate-180" : ""}`} />
                        </button>
                    </div>
                    {othersOpen ? (
                        <ul id={othersId} className="m-0 mt-0.5 mb-1 ml-3 list-none border-l border-charcoal/10 p-0 pl-2">
                            {OTHER_AMENITIES.map((id: PoiCategory) => (
                                <li key={id}>
                                    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-charcoal/85 hover:bg-charcoal/5">
                                        <input
                                            type="checkbox"
                                            checked={enabled.has(id)}
                                            onChange={(event) => setOverlay(id, event.target.checked)}
                                            className="size-4 accent-green"
                                        />
                                        <Dot color={POI_STYLE[id].color} />
                                        {POI_STYLE[id].label}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <p className="m-0 mt-2 text-[11px] leading-snug text-charcoal/50">
                        Tiện ích hiện từ zoom 13; điểm gần nhau gom thành cụm có số, phóng to để tách. Dữ liệu © OpenStreetMap. Tin chưa có tọa độ đặt gần tâm quận (nhãn nhạt hơn).
                    </p>
                </div>
            ) : null}
        </div>
    );
}
