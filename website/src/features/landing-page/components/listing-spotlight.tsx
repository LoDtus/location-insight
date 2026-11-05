"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import Link from "next/link";
import { useRef, type JSX } from "react";

import {
    LISTINGS,
    formatArea,
    formatListingPrice,
    listingPath,
} from "@/features/landing-page/data/listings";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const SPOTLIGHT_SIZE = 10;

/** Dải tin được quan tâm nhất: cuộn ngang theo từng thẻ, có nút trước/sau và nút sang trang danh sách. */
export default function ListingSpotlight(): JSX.Element {
    const { locale } = useLocale();
    const messages = useLocaleMessages("landing");
    const track = useRef<HTMLUListElement>(null);
    const text = (key: string): string => getLocaleValue(messages, ["listingsSection", key]);
    const top = [...LISTINGS].sort((a, b) => b.watchers - a.watchers).slice(0, SPOTLIGHT_SIZE);

    function slide(direction: 1 | -1): void {
        const node = track.current;
        if (!node) return;
        const card = node.querySelector("li");
        const step = card ? card.getBoundingClientRect().width + 16 : node.clientWidth * 0.8;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        node.scrollBy({ left: step * direction, behavior: reduce ? "auto" : "smooth" });
    }

    const control =
        "inline-flex size-10 items-center justify-center rounded-md border border-cream/30 bg-transparent text-cream hover:bg-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

    return (
        <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h3 className="m-0 font-display text-2xl font-semibold">{text("popular")}</h3>
                    <p className="m-0 mt-1 text-sm text-cream/70">{text("popularNote")}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" aria-label={text("previous")} onClick={() => slide(-1)} className={control}>
                        <ChevronLeft size={18} aria-hidden />
                    </button>
                    <button type="button" aria-label={text("next")} onClick={() => slide(1)} className={control}>
                        <ChevronRight size={18} aria-hidden />
                    </button>
                </div>
            </div>
            <ul
                ref={track}
                aria-label={text("popular")}
                className="m-0 mt-4 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth p-0 pb-3 [scrollbar-color:rgba(230,226,218,0.35)_transparent] [scrollbar-width:thin] motion-reduce:scroll-auto"
            >
                {top.map((listing) => (
                    <li key={listing.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%] xl:w-[23.5%]">
                        <Link
                            href={listingPath(listing)}
                            className="group flex h-full flex-col overflow-hidden rounded-lg bg-white text-charcoal no-underline shadow-[0_2px_10px_rgba(0,0,0,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
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
                    </li>
                ))}
            </ul>
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
