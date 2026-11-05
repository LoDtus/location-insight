import FaqAsk from "@/features/landing-page/components/faq-ask";
import FaqColumns from "@/features/landing-page/components/faq-columns";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const FAQ_KEYS = ["pin", "missing", "flood", "price", "plan"] as const;

export default async function CauHoiSection() {
    const messages = await getLandingMessages();

    return (
        <section
            id="cau-hoi-thuong-gap"
            aria-labelledby="tieu-de-cau-hoi-thuong-gap"
            className="box-border scroll-mt-4 bg-white px-5 py-14 sm:px-10 lg:px-24 lg:py-16 xl:px-40"
        >
            <FaqColumns
                aside={<FaqAsk />}
                questions={
                <>
                    <h2
                        id="tieu-de-cau-hoi-thuong-gap"
                        className="m-0 font-display text-[clamp(2.25rem,1.4rem+2.8vw,4rem)] leading-[0.98] font-semibold tracking-[-0.02em] sm:whitespace-nowrap"
                    >
                        {getLocaleValue(messages, ["faq", "title"])}
                    </h2>
                    <div className="mt-6 flex flex-col gap-3">
                        {FAQ_KEYS.map((key) => (
                            <details key={key} className="group rounded-lg border border-charcoal/15 bg-white px-5 shadow-[0_1px_2px_rgba(16,17,17,0.06),0_4px_14px_rgba(16,17,17,0.06)] outline-2 outline-offset-2 outline-transparent transition-[outline-color] hover:outline-green open:border-green/40 motion-reduce:transition-none">
                                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-lg font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green [&::-webkit-details-marker]:hidden">
                                    {getLocaleValue(messages, ["faq", "items", key, "q"])}
                                    <span
                                        aria-hidden="true"
                                        className="text-2xl leading-none text-green transition-transform group-open:rotate-45 motion-reduce:transition-none"
                                    >
                                        +
                                    </span>
                                </summary>
                                <p className="mt-0 mb-4 border-t border-charcoal/10 pt-3 text-sm leading-relaxed text-charcoal/80">
                                    {getLocaleValue(messages, ["faq", "items", key, "a"])}
                                </p>
                            </details>
                        ))}
                    </div>
                </>
                }
            />
        </section>
    );
}
