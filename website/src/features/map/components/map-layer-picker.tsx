"use client";

import { Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
}

export default function MapLayerPicker({
    styleId,
    onStyleChange,
    trafficAvailable,
    trafficOn,
    onTrafficChange,
}: MapLayerPickerProps) {
    const [open, setOpen] = useState(false);
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

    return (
        <div
            className="pointer-events-auto absolute bottom-2 left-2 z-10 flex items-end gap-2"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
            }}
        >
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                aria-label="Lớp bản đồ"
                onClick={() => setOpen((value) => !value)}
                className="relative size-14 shrink-0 overflow-hidden rounded-lg border-2 border-white shadow-md"
                style={{ background: current.swatch }}
            >
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/55 py-0.5 text-[10px] text-white">
                    <Layers size={12} strokeWidth={2} aria-hidden />
                    Lớp
                </span>
            </button>
            {open ? (
                <div
                    role="group"
                    aria-label="Chọn lớp bản đồ"
                    className="flex max-w-[min(100vw-6rem,42rem)] items-start gap-3 overflow-x-auto rounded-xl bg-white p-3 shadow-lg"
                >
                    {BASE_LAYERS.map((layer) => (
                        <button
                            key={layer.id}
                            type="button"
                            aria-pressed={layer.id === styleId}
                            className="flex w-20 shrink-0 flex-col items-center gap-1 text-center"
                            onClick={() => onStyleChange(layer.id)}
                        >
                            <span
                                className={`block size-16 rounded-lg border-2 ${layer.id === styleId ? "border-green" : "border-transparent ring-1 ring-charcoal/15"}`}
                                style={{ background: layer.swatch }}
                            />
                            <span className="text-xs leading-tight text-neutral-700">{layer.label}</span>
                        </button>
                    ))}
                    {trafficAvailable ? (
                        <button
                            type="button"
                            aria-pressed={trafficOn}
                            className="flex w-20 shrink-0 flex-col items-center gap-1 text-center"
                            onClick={() => onTrafficChange(!trafficOn)}
                        >
                            <span
                                className={`block size-16 rounded-lg border-2 ${trafficOn ? "border-green" : "border-transparent ring-1 ring-charcoal/15"}`}
                                style={{ background: "linear-gradient(135deg,#1a9850,#f2b705 50%,#c0392b)" }}
                            />
                            <span className="text-xs leading-tight text-neutral-700">Giao thông</span>
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
