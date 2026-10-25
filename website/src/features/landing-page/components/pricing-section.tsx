import PricingGrid from "@/features/landing-page/components/pricing-grid";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export default async function BangGiaSection() {
    const messages = await getLandingMessages();

    return (
        <section
            id="bang-gia"
            aria-labelledby="tieu-de-bang-gia"
            className="box-border min-h-[100cqh] border border-current px-50 py-16"
        >
            <h2
                id="tieu-de-bang-gia"
                className="m-0 max-w-[18ch] text-4xl leading-tight font-semibold tracking-tight"
            >
                {getLocaleValue(messages, ["pricing", "title"])}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-charcoal/75">
                {getLocaleValue(messages, ["pricing", "lede"])}
            </p>
            <PricingGrid />
        </section>
    );
}
