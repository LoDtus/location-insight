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
            className="box-border min-h-[100cqh] border border-current px-50 py-16"
        >
            <div className="grid items-start gap-12 lg:grid-cols-2">
                <div>
                    <h2
                        id="tieu-de-cau-hoi-thuong-gap"
                        className="m-0 max-w-[16ch] text-4xl leading-tight font-semibold tracking-tight"
                    >
                        {getLocaleValue(messages, ["faq", "title"])}
                    </h2>
                    <div className="mt-6 border-b border-charcoal/15">
                        {FAQ_KEYS.map((key) => (
                            <details
                                key={key}
                                className="border-t border-charcoal/15 py-1"
                            >
                                <summary className="flex min-h-11 cursor-pointer items-center py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green">
                                    {getLocaleValue(messages, ["faq", "items", key, "q"])}
                                </summary>
                                <p className="mt-1 mb-3 max-w-prose text-base leading-relaxed text-charcoal/80">
                                    {getLocaleValue(messages, ["faq", "items", key, "a"])}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
                <FaqAsk />
            </div>
        </section>
    );
}
