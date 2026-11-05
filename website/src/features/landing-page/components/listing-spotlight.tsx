"use client";

import { ArrowRight, Eye } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import {
    LISTINGS,
    formatArea,
    formatListingPrice,
    listingPath,
} from "@/features/landing-page/data/listings";
import CardSlider from "@/shared/components/slider/card-slider";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const SPOTLIGHT_SIZE = 10;

/** Dải tin được quan tâm nhất: slide Swiper (nút < > trên màn rộng, vuốt trên điện thoại) và nút sang trang danh sách. */
export default function ListingSpotlight(): JSX.Element {
    const { locale } = useLocale();
    const messages = useLocaleMessages("landing");
    const text = (key: string): string => getLocaleValue(messages, ["listingsSection", key]);
    const top = [...LISTINGS].sort((a, b) => b.watchers - a.watchers).slice(0, SPOTLIGHT_SIZE);

    return (
        <div>
            <div>
                <h3 className="m-0 font-display text-2xl font-semibold">{text("popular")}</h3>
                <p className="m-0 mt-1 text-sm text-cream/70">{text("popularNote")}</p>
            </div>
            <div className="mt-4">
                <CardSlider
                    tone="dark"
                    label={text("popular")}
                    previousLabel={text("previous")}
                    nextLabel={text("next")}
                    slides={top.map((listing) => ({
                        key: listing.id,
                        node: (
                            <Link
                                href={listingPath(listing)}
                                className="group flex h-full flex-col overflow-hidden rounded-lg bg-white text-charcoal no-underline shadow-[0_2px_10px_rgba(0,0,0,0.25)] outline-2 outline-transparent transition-[outline-color] hover:outline-gold focus-visible:outline-gold motion-reduce:transition-none"
                            >
                                <span className="relative block aspect-[4/3] overflow-hidden bg-charcoal">
                                    <img
                                        src={listing.images[0]}
                                        alt=""
                                        loading="lazy"
                                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                                    />
                                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-charcoal/80 px-2 py-0.5 text-xs font-semibold text-white">
                                        <Eye size={12} aria-hidden />
                                        {text("watchers").replace("{count}", String(listing.watchers))}
                                    </span>
                                </span>
                                <span className="flex flex-1 flex-col gap-1 p-3">
                                    <span className="text-lg leading-none font-semibold text-green tabular-nums">{formatListingPrice(listing, locale)}</span>
                                    <span className="line-clamp-2 text-sm font-semibold">{listing.title}</span>
                                    <span className="mt-auto text-xs text-charcoal/65">
                                        {formatArea(listing.areaM2, locale)} · {listing.district}
                                    </span>
                                </span>
                            </Link>
                        ),
                    }))}
                />
            </div>
            <Link
                href="/nha-dat"
                className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-md bg-gold px-6 text-base font-semibold text-charcoal no-underline hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
                {text("viewAll")}
                <ArrowRight size={18} aria-hidden />
            </Link>
        </div>
    );
}
