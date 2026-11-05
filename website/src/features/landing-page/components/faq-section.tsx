import FaqAsk from "@/features/landing-page/components/faq-ask";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const FAQ_KEYS = ["pin", "missing", "flood", "price", "plan"] as const;

export default async function CauHoiSection() {
    const messages = await getLandingMessages();

    return (
        <section
            id="cau-hoi-thuong-gap"
            aria-labelledby="tieu-de-cau-hoi-thuong-gap"
            className="box-border min-h-[100cqh] bg-white px-5 py-20 sm:px-10 lg:px-24 xl:px-40"
        >
            <div className="grid items-start gap-16 lg:grid-cols-[1.2fr_1fr]">
                <div>
                    <h2
                        id="tieu-de-cau-hoi-thuong-gap"
                        className="m-0 max-w-[14ch] font-display text-[clamp(2.5rem,1.5rem+3.2vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance"
                    >
                        {getLocaleValue(messages, ["faq", "title"])}
                    </h2>
                    <div className="mt-10 flex flex-col gap-2">
                        {FAQ_KEYS.map((key) => (
                            <details key={key} className="group bg-white px-6 py-1">
                                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-xl font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green [&::-webkit-details-marker]:hidden">
                                    {getLocaleValue(messages, ["faq", "items", key, "q"])}
                                    <span
                                        aria-hidden="true"
                                        className="text-2xl leading-none text-green transition-transform group-open:rotate-45 motion-reduce:transition-none"
                                    >
                                        +
                                    </span>
                                </summary>
                                <p className="mt-1 mb-4 max-w-prose text-base leading-relaxed text-charcoal/80">
                                    {getLocaleValue(messages, ["faq", "items", key, "a"])}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
                <div className="bg-green p-8 text-cream sm:p-10">
                    <FaqAsk />
                </div>
            </div>
        </section>
    );
}
