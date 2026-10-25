"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface MapPlaceDetailProps {
    onClose: () => void;
}

export default function MapPlaceDetail({ onClose }: MapPlaceDetailProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [onClose]);

    return (
        <div className="pointer-events-auto h-full w-120 shrink-0 p-2">
            <div
                ref={panelRef}
                role="dialog"
                aria-labelledby="tieu-de-chi-tiet"
                tabIndex={-1}
                className="flex h-full flex-col rounded-lg border bg-white p-3 outline-none"
            >
                <div className="flex items-center justify-between gap-3">
                    <h2 id="tieu-de-chi-tiet" className="m-0 text-base font-semibold">
                        Chi tiết
                    </h2>
                    <button
                        type="button"
                        aria-label="Đóng"
                        className="inline-flex size-11 items-center justify-center rounded-lg border bg-white"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
