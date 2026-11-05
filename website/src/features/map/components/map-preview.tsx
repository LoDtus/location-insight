"use client";

import { Expand } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import MapPlaceDetail from "@/features/map/components/map-place-detail";
import VietmapView from "@/features/map/components/vietmap-view";

/** Bản đồ VietMap trên landing: kéo thả, phóng to thật; bấm vào bản đồ để mở thẻ địa điểm mẫu. */
export default function MapPreview() {
    const [detailOpen, setDetailOpen] = useState(true);

    return (
        <div className="flex h-full min-h-0 w-full flex-col gap-2 xl:flex-row">
            <div className="relative min-h-[24rem] min-w-0 flex-1 overflow-hidden">
                <div className="absolute inset-0">
                    <VietmapView marker={false} label="Bản đồ Hà Nội" className="h-full w-full" onMapClick={() => setDetailOpen(true)} />
                </div>
                <Link
                    href="/app/map"
                    aria-label="Mở rộng bản đồ"
                    className="absolute top-2 left-2 z-10 inline-flex rounded-md border border-charcoal/20 bg-white p-2"
                >
                    <Expand size={18} aria-hidden="true" />
                </Link>
            </div>
            {detailOpen ? <MapPlaceDetail placement="beside" onClose={() => setDetailOpen(false)} /> : null}
        </div>
    );
}
