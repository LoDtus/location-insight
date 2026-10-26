"use client";

import { useState } from "react";

import MapLayer from "@/features/map/components/map-layer";
import MapPlaceDetail from "@/features/map/components/map-place-detail";
import MapScaleBar from "@/features/map/components/map-scale-bar";
import MapSearch from "@/features/map/components/map-search";
import MapZoomControls from "@/features/map/components/map-zoom-controls";

const ZOOM_MIN = 8;
const ZOOM_MAX = 20;

export default function MapPreview() {
    const [zoom, setZoom] = useState(12);
    const [detailOpen, setDetailOpen] = useState(true);

    function zoomIn(): void {
        setZoom((current) => Math.min(current + 1, ZOOM_MAX));
    }

    function zoomOut(): void {
        setZoom((current) => Math.max(current - 1, ZOOM_MIN));
    }

    return (
        <div className="flex h-full min-h-0 w-full flex-col gap-2 xl:flex-row">
            <div className="relative min-h-[24rem] min-w-0 flex-1 overflow-hidden">
                <MapLayer onSelect={() => setDetailOpen(true)} />
                <div className="pointer-events-none absolute inset-0">
                    <MapSearch />
                    <MapScaleBar zoom={zoom} />
                    <MapZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
                </div>
            </div>
            {detailOpen ? (
                <MapPlaceDetail
                    placement="beside"
                    onClose={() => setDetailOpen(false)}
                />
            ) : null}
        </div>
    );
}
