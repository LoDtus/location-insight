"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import MapLayer from "@/features/map/components/map-layer";
import MapLayerPicker from "@/features/map/components/map-layer-picker";
import MapPlaceDetail from "@/features/map/components/map-place-detail";
import MapScaleBar from "@/features/map/components/map-scale-bar";
import MapSearch from "@/features/map/components/map-search";
import MapSidebar from "@/features/map/components/map-sidebar";
import MapZoomControls from "@/features/map/components/map-zoom-controls";

const ZOOM_MIN = 8;
const ZOOM_MAX = 20;

interface MapScreenProps {
    placeId?: string;
}

export default function MapScreen({ placeId }: MapScreenProps) {
    const router = useRouter();
    const [zoom, setZoom] = useState(12);
    const [detailOpen, setDetailOpen] = useState(placeId !== undefined);

    const closeDetail = useCallback((): void => {
        setDetailOpen(false);

        if (placeId !== undefined) {
            router.push("/app/map");
        }
    }, [placeId, router]);

    function zoomIn(): void {
        setZoom((current) => Math.min(current + 1, ZOOM_MAX));
    }

    function zoomOut(): void {
        setZoom((current) => Math.max(current - 1, ZOOM_MIN));
    }

    return (
        <div className="relative h-full w-full">
            <MapLayer onSelect={() => setDetailOpen(true)} />
            <div className="pointer-events-none absolute inset-0">
                <div className="flex h-full w-full min-h-0">
                    <div className="relative flex min-h-0 min-w-0 flex-1">
                        <MapSidebar />
                        <div className="relative min-h-0 min-w-0 flex-1">
                            <MapSearch />
                            <MapLayerPicker />
                            <MapScaleBar zoom={zoom} />
                            <MapZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
                        </div>
                    </div>
                    {detailOpen ? <MapPlaceDetail onClose={closeDetail} /> : null}
                </div>
            </div>
        </div>
    );
}
