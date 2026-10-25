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
            className="box-border flex min-h-[100cqh] flex-col justify-center border border-current px-50 py-10"
        >
            <h2
                id="tieu-de-nha-dat"
                className="m-0 max-w-[14ch] text-4xl leading-tight font-semibold tracking-tight"
            >
                {title}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-charcoal/75">
                {getLocaleValue(messages, ["listingsSection", "subtitle"])}
            </p>
            <Link
                href="/nha-dat"
                className="mt-8 inline-flex min-h-11 w-fit items-center rounded-full bg-green px-6 text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            >
                {getLocaleValue(messages, ["listingsSection", "cta"])}
            </Link>
        </section>
    );
}
