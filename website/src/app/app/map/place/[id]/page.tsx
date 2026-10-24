"use client";

import {
    Bookmark,
    Layers,
    LocateFixed,
    Megaphone,
    Minus,
    Plus,
    Search,
    Settings,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

const MAP_LAYERS = [
    { id: "terrain", label: "Địa hình" },
    { id: "traffic", label: "Tình trạng giao thông" },
    { id: "transit", label: "Phương tiện công cộng" },
    { id: "cycling", label: "Đi xe đạp" },
    { id: "more", label: "Xem thêm", icon: Layers },
] as const;

const SIDEBAR_ACTIONS = [
    { id: "saved", label: "Đã lưu", icon: Bookmark },
    { id: "listings", label: "Rao bán", icon: Megaphone },
    { id: "settings", label: "Cài đặt", icon: Settings },
] as const;

const LAYER_CLOSE_DELAY_MS = 2000;
const LAYER_TRIGGER_CLASS = "h-14 w-14";
const LAYER_MENU_THUMB_CLASS = "h-16 w-16";
const ZOOM_MIN = 8;
const ZOOM_MAX = 20;
const SCALE_BAR_PX = 56;

function niceMeters(value: number): number {
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let closest = steps[0];

    for (const step of steps) {
        if (Math.abs(step - value) < Math.abs(closest - value)) {
            closest = step;
        }
    }

    return closest;
}

function formatScaleLabel(meters: number): string {
    if (meters >= 1000) {
        return `${meters / 1000} km`;
    }

    return `${meters} m`;
}

function scaleBarForZoom(zoom: number): { label: string; barPx: number } {
    const rawMeters = 3200 / Math.pow(2, zoom - 11);
    const meters = niceMeters(rawMeters);

    return {
        label: formatScaleLabel(meters),
        barPx: SCALE_BAR_PX,
    };
}

export default function Page() {
    const [layersOpen, setLayersOpen] = useState(false);
    const [zoom, setZoom] = useState(12);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scale = useMemo(() => scaleBarForZoom(zoom), [zoom]);

    function clearCloseTimer(): void {
        if (closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }

    function scheduleClose(): void {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
            setLayersOpen(false);
            closeTimerRef.current = null;
        }, LAYER_CLOSE_DELAY_MS);
    }

    function handleLayersEnter(): void {
        clearCloseTimer();
    }

    function handleLayersLeave(): void {
        scheduleClose();
    }

    function zoomIn(): void {
        setZoom((current) => Math.min(current + 1, ZOOM_MAX));
    }

    function zoomOut(): void {
        setZoom((current) => Math.max(current - 1, ZOOM_MIN));
    }

    return (
        <div className="w-full h-full relative">
            <img
                src="/images/temp-001.png"
                alt="Map"
                className="w-full h-full object-cover"
            />
            <div className="absolute top-0 left-0 p-0 m-0 w-full h-full">
                <div className="flex h-full w-full min-h-0">
                    <div className="relative flex min-h-0 min-w-0 flex-1">
                        <aside
                            aria-label="Thao tác bản đồ"
                            className="flex h-full w-[4.25rem] shrink-0 flex-col items-center border-r border-neutral-200 bg-neutral-50 py-3"
                        >
                            <div className="flex flex-col items-center gap-5">
                                {SIDEBAR_ACTIONS.filter(
                                    (action) => action.id !== "settings",
                                ).map((action) => {
                                    const Icon = action.icon;

                                    return (
                                        <button
                                            key={action.id}
                                            type="button"
                                            className="flex w-full flex-col items-center gap-1 px-1 text-center"
                                        >
                                            <Icon size={22} strokeWidth={1.75} />
                                            <span className="text-[11px] leading-tight text-neutral-800">
                                                {action.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-auto flex w-full flex-col items-center border-t border-neutral-200 pt-3">
                                <button
                                    type="button"
                                    className="flex w-full flex-col items-center gap-1 px-1 text-center"
                                >
                                    <Settings size={22} strokeWidth={1.75} />
                                    <span className="text-[11px] leading-tight text-neutral-800">
                                        Cài đặt
                                    </span>
                                </button>
                            </div>
                        </aside>

                        <div className="relative min-h-0 min-w-0 flex-1">
                        <div className="absolute top-2 left-2 z-10 w-fit py-2 px-4 flex gap-2 bg-white rounded-full shadow-sm">
                            <input placeholder="Tìm kiếm" className="" />
                            <Search />
                        </div>

                        <div
                            className="absolute bottom-2 left-2 z-10 flex items-end gap-2"
                            onMouseEnter={handleLayersEnter}
                            onMouseLeave={handleLayersLeave}
                        >
                            <button
                                type="button"
                                aria-expanded={layersOpen}
                                aria-haspopup="true"
                                aria-label="Lớp bản đồ"
                                onClick={() => setLayersOpen(true)}
                                className={`relative shrink-0 overflow-hidden rounded-lg border-2 border-white shadow-md ${LAYER_TRIGGER_CLASS}`}
                            >
                                <img
                                    src="/images/temp-001.png"
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/55 py-0.5 text-[10px] text-white">
                                    <Layers size={12} strokeWidth={2} />
                                    Lớp
                                </span>
                            </button>
                            {layersOpen ? (
                                <div
                                    role="menu"
                                    aria-label="Lớp bản đồ"
                                    className="flex max-w-[min(100vw-6rem,42rem)] gap-3 overflow-x-auto rounded-xl bg-white p-3 shadow-lg"
                                >
                                    {MAP_LAYERS.map((layer) => {
                                        const Icon =
                                            "icon" in layer ? layer.icon : null;

                                        return (
                                            <button
                                                key={layer.id}
                                                type="button"
                                                role="menuitem"
                                                className="flex w-20 shrink-0 flex-col items-center gap-1 text-center"
                                            >
                                                <span
                                                    className={`flex items-center justify-center overflow-hidden rounded-lg border bg-neutral-100 ${LAYER_MENU_THUMB_CLASS}`}
                                                >
                                                    {Icon ? (
                                                        <Icon
                                                            size={28}
                                                            strokeWidth={1.5}
                                                        />
                                                    ) : null}
                                                </span>
                                                <span className="text-xs leading-tight text-neutral-700">
                                                    {layer.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>

                        <div
                            className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5"
                            aria-hidden
                        >
                            <span className="text-[10px] leading-none text-neutral-800">
                                {scale.label}
                            </span>
                            <span
                                className="block h-0.5 bg-neutral-800"
                                style={{ width: scale.barPx }}
                            />
                        </div>

                        <div className="absolute bottom-2 right-2 z-10 flex flex-row gap-1">
                            <button
                                type="button"
                                aria-label="Phóng to"
                                className="p-2 bg-white border rounded-lg"
                                onClick={zoomIn}
                            >
                                <Plus size={18} />
                            </button>
                            <button
                                type="button"
                                aria-label="Thu nhỏ"
                                className="p-2 bg-white border rounded-lg"
                                onClick={zoomOut}
                            >
                                <Minus size={18} />
                            </button>
                            <button
                                type="button"
                                aria-label="Quay lại vị trí hiện tại"
                                className="p-2 bg-white border rounded-lg"
                            >
                                <LocateFixed size={18} />
                            </button>
                        </div>
                        </div>
                    </div>
                    <div className="w-120 shrink-0 h-full p-2">
                        <div className="w-full h-full p-3 border rounded-lg bg-white">
                            Chi tiết
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
