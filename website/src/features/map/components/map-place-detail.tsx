"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
    MAP_PLACE_SLUG,
    formatArea,
    formatListingPrice,
    getListingByParam,
    listingPath,
} from "@/features/landing-page/data/listings";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

interface MapPlaceDetailProps {
    onClose: () => void;
    placement?: "overlay" | "beside";
    listingHref?: string;
}

export default function MapPlaceDetail({
    onClose,
    placement = "overlay",
    listingHref,
}: MapPlaceDetailProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const beside = placement === "beside";
    const { locale } = useLocale();
    const messages = useLocaleMessages("landing");
    const listing = getListingByParam(MAP_PLACE_SLUG);
    const [analyzed, setAnalyzed] = useState(false);

    useEffect(() => {
        if (!beside) {
            panelRef.current?.focus();
        }
    }, [beside]);

    useEffect(() => {
        if (beside) {
            return;
        }

        function onKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [beside, onClose]);

    const purpose = listing
        ? getLocaleValue(messages, [
              "catalog",
              listing.purpose === "ban" ? "purposeBan" : "purposeThue",
          ])
        : "";

    return (
        <div
            className={
                beside
                    ? "flex h-80 w-full shrink-0 flex-col xl:h-full xl:w-120"
                    : "pointer-events-auto h-full w-120 shrink-0 p-2"
            }
        >
            <div
                ref={panelRef}
                role={beside ? "complementary" : "dialog"}
                aria-labelledby="tieu-de-chi-tiet"
                tabIndex={beside ? undefined : -1}
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
                {listing ? (
                    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3">
                            <img
                                src={listing.images[0]}
                                alt=""
                                className="h-[5.5rem] w-[5.5rem] rounded-xl object-cover"
                            />
                            <div className="min-w-0">
                                <p className="m-0 text-xl leading-tight font-semibold text-green">
                                    {formatListingPrice(listing, locale)}
                                </p>
                                <p className="m-0 mt-0.5 font-semibold leading-snug">
                                    {listing.title}
                                </p>
                                <p className="m-0 text-sm text-charcoal/70">
                                    {listing.location}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    <span className="inline-flex min-h-7 items-center rounded-full bg-green px-2.5 text-xs font-semibold text-cream">
                                        {purpose}
                                    </span>
                                    <span className="inline-flex min-h-7 items-center rounded-full border border-charcoal/30 px-2.5 text-xs font-semibold">
                                        {formatArea(listing.areaM2, locale)}
                                    </span>
                                    {listing.beds > 0 ? (
                                        <span className="inline-flex min-h-7 items-center rounded-full border border-charcoal/30 px-2.5 text-xs font-semibold">
                                            {listing.beds}{" "}
                                            {getLocaleValue(messages, ["catalog", "specBeds"])}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <Link
                            href={listingHref ?? listingPath(listing)}
                            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-charcoal/30 bg-white px-4 text-sm font-semibold no-underline"
                        >
                            {getLocaleValue(messages, ["catalog", "detail", "fullPage"])}
                        </Link>
                        <div className="border-t border-charcoal/15 pt-4">
                            <h3 className="m-0 text-base font-semibold">
                                {getLocaleValue(messages, ["catalog", "detail", "analysis"])}
                            </h3>
                            <p className="m-0 mt-1 text-sm text-charcoal/60">
                                {getLocaleValue(messages, [
                                    "catalog",
                                    "detail",
                                    "analysisSubject",
                                ])}
                            </p>
                            <span className="mt-3 inline-flex min-h-7 items-center rounded-full bg-gold/25 px-3 text-[13px] font-semibold">
                                {getLocaleValue(messages, [
                                    "catalog",
                                    "detail",
                                    "analysisSample",
                                ])}
                            </span>
                            {analyzed ? (
                                <p className="m-0 mt-3 text-sm" role="status">
                                    {getLocaleValue(messages, [
                                        "catalog",
                                        "detail",
                                        "analysisDone",
                                    ])}
                                </p>
                            ) : (
                                <>
                                    <p className="m-0 mt-3 text-sm text-charcoal/70">
                                        {getLocaleValue(messages, [
                                            "catalog",
                                            "detail",
                                            "analysisLede",
                                        ])}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyzed(true)}
                                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-green px-4 text-sm text-cream"
                                    >
                                        {getLocaleValue(messages, [
                                            "catalog",
                                            "detail",
                                            "analysisRun",
                                        ])}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
