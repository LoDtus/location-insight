"use client";

import { Check, Copy, Loader2, Navigation, Route } from "lucide-react";
import { useState } from "react";

import MapPanel from "@/features/map/components/map-panel";
import { formatCoordinates } from "@/features/map/map.geo";
import type { PlaceSelection } from "@/features/map/hooks/use-place-selection";

interface MapPlacePanelProps {
    selection: Exclude<PlaceSelection, { status: "none" }>;
    onClose: () => void;
    onDirectionsTo: () => void;
    onDirectionsFrom: () => void;
}

export default function MapPlacePanel({
    selection,
    onClose,
    onDirectionsTo,
    onDirectionsFrom,
}: MapPlacePanelProps) {
    const [copied, setCopied] = useState(false);
    const coordinates = formatCoordinates(selection.point);
    const place = selection.status === "ready" ? selection.place : null;

    async function copy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(coordinates);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    return (
        <MapPanel title="Địa điểm" titleId="tieu-de-dia-diem" onClose={onClose}>
            {selection.status === "loading" ? (
                <p className="m-0 flex items-center gap-2 text-sm text-charcoal/70" role="status">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> Đang lấy địa chỉ…
                </p>
            ) : null}
            {selection.status === "error" ? (
                <p className="m-0 text-sm text-red-700" role="alert">
                    {selection.message}
                </p>
            ) : null}
            {selection.status === "ready" && !place ? (
                <p className="m-0 text-sm text-charcoal/70">Không có địa chỉ gần điểm này.</p>
            ) : null}
            {place ? (
                <div>
                    <p className="m-0 text-lg leading-tight font-semibold">{place.name}</p>
                    <p className="m-0 mt-1 text-sm text-charcoal/80">{place.address}</p>
                    {place.addressOld ? (
                        <p className="m-0 text-xs text-charcoal/55">Trước đây: {place.addressOld}</p>
                    ) : null}
                </div>
            ) : null}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-charcoal/5 px-3 py-2">
                <span className="font-mono text-sm">{coordinates}</span>
                <button
                    type="button"
                    aria-label="Sao chép tọa độ"
                    className="inline-flex size-9 items-center justify-center rounded-lg border bg-white"
                    onClick={() => void copy()}
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-green px-3 text-sm font-semibold text-cream"
                    onClick={onDirectionsTo}
                >
                    <Navigation size={16} aria-hidden /> Chỉ đường đến đây
                </button>
                <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-charcoal/30 bg-white px-3 text-sm font-semibold"
                    onClick={onDirectionsFrom}
                >
                    <Route size={16} aria-hidden /> Xuất phát từ đây
                </button>
            </div>
            <p className="m-0 text-xs text-charcoal/55">
                Địa chỉ có thể lệch vài chục mét. Kéo ghim cho đúng ô đất; phân tích bám tọa độ của ghim.
            </p>
        </MapPanel>
    );
}
