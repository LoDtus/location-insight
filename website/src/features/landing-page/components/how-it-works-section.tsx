import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const STEPS = ["0", "1", "2", "3"] as const;

export default async function CachHoatDongSection() {
    const messages = await getLandingMessages();

    return (
        <section
            id="cach-hoat-dong"
            aria-labelledby="tieu-de-cach-hoat-dong"
            className="box-border grid min-h-[100cqh] gap-14 bg-white px-5 py-20 sm:px-10 lg:grid-cols-[1fr_1.3fr] lg:gap-24 lg:px-24 xl:px-40"
        >
            <div className="lg:sticky lg:top-24 lg:self-start">
                <h2
                    id="tieu-de-cach-hoat-dong"
                    className="m-0 max-w-[12ch] font-display text-[clamp(2.5rem,1.5rem+3.2vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance"
                >
                    {getLocaleValue(messages, ["how", "title"])}
                </h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-charcoal/80">
                    {getLocaleValue(messages, ["how", "lede"])}
                </p>
            </div>
            <ol className="m-0 flex list-none flex-col gap-12 p-0">
                {STEPS.map((key) => (
                    <li key={key} className="border-l-4 border-gold pl-6 sm:pl-8">
                        <h3 className="m-0 font-display text-3xl leading-tight font-semibold">
                            {getLocaleValue(messages, ["how", "steps", key, "title"])}
                        </h3>
                        <p className="mt-1 mb-0 text-base font-semibold text-green">
                            {getLocaleValue(messages, ["how", "steps", key, "hint"])}
                        </p>
                        <p className="mt-4 mb-0 max-w-prose text-base leading-relaxed">
                            {getLocaleValue(messages, ["how", "steps", key, "0"])}
                        </p>
                        <p className="mt-2 mb-0 max-w-prose text-base leading-relaxed text-charcoal/75">
                            {getLocaleValue(messages, ["how", "steps", key, "1"])}
                        </p>
                    </li>
                ))}
            </ol>
        </section>
    );
}
