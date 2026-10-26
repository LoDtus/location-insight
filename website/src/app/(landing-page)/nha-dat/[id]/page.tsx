import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ListingDetail from "@/features/landing-page/components/listing-detail";
import {
    LISTINGS,
    formatListingPrice,
    getListingById,
} from "@/features/landing-page/data/listings";
import { getLocale } from "@/shared/services/locale.service";

type PageProps = {
    params: Promise<{ id: string }>;
};

export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
    return LISTINGS.map((listing) => ({ id: listing.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const listing = getListingById(id);

    if (!listing) {
        return {};
    }

    const locale = await getLocale();

    return {
        title: listing.title,
        description: `${formatListingPrice(listing, locale)} · ${listing.location}`,
    };
}

export default async function Page({ params }: PageProps) {
    const { id } = await params;

    if (!getListingById(id)) {
        notFound();
    }

    return <ListingDetail id={id} />;
}
