import DraftListingDetail from "@/features/properties/components/draft-listing-detail";
import ListingDetail from "@/features/landing-page/components/listing-detail";
import { getListingByParam } from "@/features/landing-page/data/listings";

type PageProps = {
    params: Promise<{ slug: string }>;
};

export default async function Page({ params }: PageProps) {
    const { slug } = await params;
    const listing = getListingByParam(slug);
    if (!listing) {
        return <DraftListingDetail slug={slug} surface="admin" />;
    }

    return <ListingDetail id={slug} surface="admin" />;
}
