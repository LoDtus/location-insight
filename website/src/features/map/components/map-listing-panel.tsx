"use client";

import { ArrowRight, BedDouble, Bath, Eye, Images, MapPin, Navigation, Ruler } from "lucide-react";
import Link from "next/link";
import { useState, type JSX } from "react";

import { formatArea, formatListingPrice } from "@/features/landing-page/data/listings";
import MapPanel from "@/features/map/components/map-panel";
import type { ListingPin } from "@/features/map/map-overlays";
import ImageLightbox from "@/shared/components/lightbox/image-lightbox";

const KIND_LABEL: Record<string, string> = { "can-ho": "Căn hộ", "nha-pho": "Nhà phố", "biet-thu": "Biệt thự", dat: "Đất" };

/** Thẻ tin rao khi bấm nhãn giá trên bản đồ. */
export default function MapListingPanel({
    pin,
    root,
    onDirections,
    onClose,
}: {
    pin: ListingPin;
    root: string;
    onDirections: () => void;
    onClose: () => void;
}): JSX.Element {
    const { listing, approximate } = pin;
    const [viewer, setViewer] = useState<number | null>(null);
    return (
        <MapPanel title="Tin rao" titleId="tieu-de-tin-rao" onClose={onClose}>
            {listing.images.length > 0 ? (
                <button
                    type="button"
                    onClick={() => setViewer(0)}
                    aria-label={`Xem ${listing.images.length} ảnh`}
                    className="relative aspect-[16/10] w-full cursor-zoom-in overflow-hidden rounded-md bg-charcoal/5 p-0"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
                    <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded bg-charcoal/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        <Images size={12} aria-hidden /> {listing.images.length}
                    </span>
                </button>
            ) : null}
            <div>
                <p className="m-0 inline-flex rounded-md bg-charcoal/5 px-2 py-0.5 text-xs font-semibold text-charcoal/75">
                    {listing.purpose === "thue" ? "Cho thuê" : "Bán"} · {KIND_LABEL[listing.kind] ?? listing.kind}
                </p>
                <h3 className="m-0 mt-1.5 text-lg leading-snug font-semibold text-balance">{listing.title}</h3>
                <p className="m-0 mt-1 text-xl font-semibold text-green">{formatListingPrice(listing, "vi")}</p>
                <p className="m-0 mt-1 flex items-start gap-1.5 text-sm text-charcoal/70">
                    <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden /> {listing.location}
                </p>
                {approximate ? (
                    <p className="m-0 mt-2 rounded-md bg-gold/15 px-2.5 py-1.5 text-xs text-charcoal/80">
                        Tin chưa có tọa độ chính xác: ghim đặt gần tâm {listing.district}.
                    </p>
                ) : null}
            </div>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 text-sm">
                <li className="flex items-center gap-1.5">
                    <Ruler size={15} className="text-charcoal/50" aria-hidden /> {formatArea(listing.areaM2, "vi")}
                </li>
                {listing.beds > 0 ? (
                    <li className="flex items-center gap-1.5">
                        <BedDouble size={15} className="text-charcoal/50" aria-hidden /> {listing.beds} phòng ngủ
                    </li>
                ) : null}
                {listing.baths > 0 ? (
                    <li className="flex items-center gap-1.5">
                        <Bath size={15} className="text-charcoal/50" aria-hidden /> {listing.baths} phòng tắm
                    </li>
                ) : null}
                <li className="flex items-center gap-1.5">
                    <Eye size={15} className="text-charcoal/50" aria-hidden /> {listing.watchers.toLocaleString("vi-VN")} người quan tâm
                </li>
            </ul>
            <div className="flex gap-2">
                <Link
                    href={`${root}/properties/${listing.slug}`}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-green px-3 text-sm font-semibold text-cream no-underline hover:bg-green/90"
                >
                    Xem tin <ArrowRight size={16} aria-hidden />
                </Link>
                <button
                    type="button"
                    onClick={onDirections}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-charcoal/15 bg-white px-3 text-sm font-semibold hover:bg-charcoal/5"
                >
                    <Navigation size={16} aria-hidden /> Chỉ đường
                </button>
            </div>
            {viewer !== null ? (
                <ImageLightbox
                    images={listing.images.map((src, index) => ({ src, alt: `${listing.title} – ${index + 1}` }))}
                    start={viewer}
                    onClose={() => setViewer(null)}
                />
            ) : null}
        </MapPanel>
    );
}
