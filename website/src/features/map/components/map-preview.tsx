"use client";

import { Expand } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DISTRICT_CENTERS } from "@/features/landing-page/data/district-centers";
import { LISTINGS, MAP_PLACE_SLUG, formatListingPrice } from "@/features/landing-page/data/listings";
import MapPlaceDetail from "@/features/map/components/map-place-detail";
import VietmapView, { type MapViewPin } from "@/features/map/components/vietmap-view";

/** Mỗi quận một tin, đặt ở tâm quận (mỗi quận một ghim nên không chồng nhau). Tin mẫu của bản đồ đứng đầu. */
const PREVIEW_PINS: readonly MapViewPin[] = (() => {
    const seen = new Set<string>();
    const picked = [...LISTINGS].sort((a, b) => Number(b.slug === MAP_PLACE_SLUG) - Number(a.slug === MAP_PLACE_SLUG));
    return picked
        .filter((listing) => {
            if (seen.has(listing.district) || !DISTRICT_CENTERS[listing.district]) return false;
            seen.add(listing.district);
            return true;
        })
        .slice(0, 8)
        .map((listing) => {
            const center = DISTRICT_CENTERS[listing.district];
            return {
                id: listing.slug,
                point: { lat: center.lat, lng: center.lng },
                label: `${listing.title} · ${formatListingPrice(listing, "vi")}`,
            };
        });
})();

/**
 * Bản đồ VietMap trên landing: kéo thả, phóng to thật; chỉ bấm được vào các ghim có sẵn để xem "Chi tiết".
 * Bấm chỗ khác trên bản đồ không làm gì; các chức năng khác nằm ở bản đồ mở rộng.
 */
export default function MapPreview() {
    const [active, setActive] = useState(PREVIEW_PINS[0]?.id ?? MAP_PLACE_SLUG);

    return (
        <div className="flex h-full min-h-0 w-full flex-col gap-2 xl:flex-row">
            <div className="relative min-h-[28rem] min-w-0 flex-1 overflow-hidden rounded-md">
                <div className="absolute inset-0">
                    <VietmapView
                        center={{ lat: 21.03, lng: 105.83 }}
                        zoom={11.5}
                        marker={false}
                        label="Bản đồ Hà Nội"
                        className="h-full w-full"
                        pins={PREVIEW_PINS}
                        activePin={active}
                        onPinClick={setActive}
                    />
                </div>
                <Link
                    href="/app/map"
                    aria-label="Mở rộng bản đồ"
                    className="absolute top-2 left-2 z-10 inline-flex rounded-md border border-charcoal/20 bg-white p-2"
                >
                    <Expand size={18} aria-hidden="true" />
                </Link>
            </div>
            <MapPlaceDetail key={active} placement="beside" slug={active} />
        </div>
    );
}
