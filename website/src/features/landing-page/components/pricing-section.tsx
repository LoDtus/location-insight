import PricingGrid from "@/features/landing-page/components/pricing-grid";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export default async function BangGiaSection() {
    const messages = await getLandingMessages();

    return (
        <section
            id="bang-gia"
            aria-labelledby="tieu-de-bang-gia"
            className="box-border min-h-[100cqh] bg-white px-5 py-20 sm:px-10 lg:px-24 xl:px-40"
        >
            <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
                <h2
                    id="tieu-de-bang-gia"
                    className="m-0 max-w-[14ch] font-display text-[clamp(2.5rem,1.5rem+3.2vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance"
                >
                    {getLocaleValue(messages, ["pricing", "title"])}
                </h2>
                <p className="m-0 max-w-md text-lg leading-relaxed text-charcoal/80">
                    {getLocaleValue(messages, ["pricing", "lede"])}
                </p>
            </div>
            <PricingGrid />
        </section>
    );
}
