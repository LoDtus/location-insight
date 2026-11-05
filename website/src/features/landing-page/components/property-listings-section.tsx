import Link from "next/link";

import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function MuaBanNhaDatSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "listings"]);

    return (
        <section
            id="nha-dat"
            aria-labelledby="tieu-de-nha-dat"
            className="box-border grid min-h-[100cqh] items-center gap-12 bg-charcoal px-5 py-20 text-cream sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:px-24 xl:px-40"
        >
            <div>
                <h2
                    id="tieu-de-nha-dat"
                    className="m-0 max-w-[12ch] font-display text-[clamp(2.75rem,1.6rem+3.8vw,5.25rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance"
                >
                    {title}
                </h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-cream/80">
                    {getLocaleValue(messages, ["listingsSection", "subtitle"])}
                </p>
                <Link
                    href="/nha-dat"
                    className="mt-10 inline-flex min-h-14 w-fit items-center bg-gold px-8 text-base font-semibold tracking-wide text-charcoal transition-colors hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                >
                    {getLocaleValue(messages, ["listingsSection", "cta"])}
                </Link>
            </div>
            <div className="relative grid grid-cols-[3fr_2fr] items-end gap-4" aria-hidden="true">
                <img
                    src="/images/temp-004.jpg"
                    alt=""
                    className="aspect-[3/4] w-full object-cover"
                />
                <img
                    src="/images/temp-002.jpg"
                    alt=""
                    className="aspect-square w-full object-cover"
                />
            </div>
        </section>
    );
}
