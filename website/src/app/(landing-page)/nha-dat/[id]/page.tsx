import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ListingDetail from "@/features/landing-page/components/listing-detail";
import {
    LISTINGS,
    formatListingPrice,
    getListingByParam,
    listingPath,
} from "@/features/landing-page/data/listings";
import ENV from "@/shared/constants/env.constant";
import { getLocale } from "@/shared/services/locale.service";

type PageProps = {
    params: Promise<{ id: string }>;
};

export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
    return LISTINGS.flatMap((listing) => [
        { id: listing.slug },
        { id: listing.id },
    ]);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const listing = getListingByParam(id);

    if (!listing) {
        return {};
    }

    const locale = await getLocale();

    return {
        title: listing.title,
        description: `${formatListingPrice(listing, locale)} · ${listing.location}`,
        alternates: {
            canonical: `${ENV.WEBSITE_URL}${listingPath(listing)}`,
        },
    };
}

export default async function Page({ params }: PageProps) {
    const { id } = await params;

    if (!getListingByParam(id)) {
        notFound();
    }

    return <ListingDetail id={id} />;
}
