"use client";

import { Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MAP_LAYERS = [
    { id: "terrain", label: "Địa hình" },
    { id: "traffic", label: "Tình trạng giao thông" },
    { id: "transit", label: "Phương tiện công cộng" },
    { id: "cycling", label: "Đi xe đạp" },
    { id: "more", label: "Xem thêm", icon: Layers },
] as const;

const LAYER_CLOSE_DELAY_MS = 2000;
const LAYER_TRIGGER_CLASS = "h-14 w-14";
const LAYER_MENU_THUMB_CLASS = "h-16 w-16";

export default function MapLayerPicker() {
    const [layersOpen, setLayersOpen] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    useEffect(() => {
        return () => {
            clearCloseTimer();
        };
    }, []);

    return (
        <div
            className="pointer-events-auto absolute bottom-2 left-2 z-10 flex items-end gap-2"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
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
                        const Icon = "icon" in layer ? layer.icon : null;

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
                                        <Icon size={28} strokeWidth={1.5} />
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
    );
}
