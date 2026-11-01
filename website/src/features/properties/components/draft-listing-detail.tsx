"use client";

import { notFound } from "next/navigation";
import { useEffect, useState, type JSX } from "react";

import ListingDetail from "@/features/landing-page/components/listing-detail";
import { findDraft } from "@/features/properties/property-drafts";
import type { Listing } from "@/features/landing-page/data/listings";

export default function DraftListingDetail({
    slug,
    surface,
}: {
    slug: string;
    surface: "app" | "admin";
}): JSX.Element | null {
    const [listing, setListing] = useState<Listing | null | undefined>(undefined);

    useEffect(() => {
        setListing(findDraft(slug) ?? null);
    }, [slug]);

    if (listing === undefined) {
        return <p className="m-0 px-4 py-8 text-sm">Đang tải tin.</p>;
    }

    if (!listing) notFound();

    return <ListingDetail id={slug} surface={surface} listing={listing} />;
}
