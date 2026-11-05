import ListingSpotlight from "@/features/landing-page/components/listing-spotlight";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export default async function MuaBanNhaDatSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "listings"]);

    return (
        <section
            id="nha-dat"
            aria-labelledby="tieu-de-nha-dat"
            className="box-border scroll-mt-4 bg-charcoal px-5 py-14 text-cream sm:px-10 lg:px-24 lg:py-16 xl:px-40"
        >
            <div className="grid items-end gap-4 lg:grid-cols-[1fr_1fr] lg:gap-16">
                <h2
                    id="tieu-de-nha-dat"
                    className="m-0 font-display text-[clamp(2.25rem,1.4rem+2.8vw,4rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance"
                >
                    {title}
                </h2>
                <p className="m-0 max-w-md text-base leading-relaxed text-cream/80 lg:justify-self-end">
                    {getLocaleValue(messages, ["listingsSection", "subtitle"])}
                </p>
            </div>
            <div className="mt-8">
                <ListingSpotlight />
            </div>
        </section>
    );
}
