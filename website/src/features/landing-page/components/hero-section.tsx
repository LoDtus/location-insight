import HeroSearch from "@/features/landing-page/components/hero-search";
import HeroSlides from "@/features/landing-page/components/hero-slides";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const SLIDES = [
    { src: "/images/temp-002.jpg", key: "apartment" },
    { src: "/images/temp-003.jpg", key: "garden" },
    { src: "/images/temp-004.jpg", key: "tower" },
] as const;

const STATS = ["sources", "users", "listings", "analyses"] as const;

export default async function HeroSection() {
    const messages = await getLandingMessages();
    const label = getLocaleValue(messages, ["sections", "intro"]);
    const title = getLocaleValue(messages, ["hero", "title"]);
    const subtitle = getLocaleValue(messages, ["hero", "subtitle"]);
    const placeholder = getLocaleValue(messages, ["hero", "placeholder"]);
    const submit = getLocaleValue(messages, ["hero", "submit"]);

    return (
        <section
            id="gioi-thieu"
            aria-label={label}
            className="box-border grid min-h-[100cqh] bg-green text-cream lg:grid-cols-[1.1fr_1fr] lg:grid-rows-[minmax(0,1fr)_auto]"
        >
            <div className="flex flex-col justify-center px-5 py-16 sm:px-10 lg:py-10 lg:pr-16 lg:pl-24 xl:pl-40">
                <h1 className="m-0 max-w-[11ch] font-display text-[clamp(3rem,1.4rem+5.4vw,6.5rem)] leading-[0.95] font-semibold tracking-[-0.02em] text-balance">
                    {title}
                </h1>
                <p className="mt-8 max-w-md text-lg leading-relaxed text-cream/85">
                    {subtitle}
                </p>
                <HeroSearch placeholder={placeholder} submit={submit} />
            </div>
            <HeroSlides
                previousLabel={getLocaleValue(messages, ["hero", "previous"])}
                nextLabel={getLocaleValue(messages, ["hero", "next"])}
                slides={SLIDES.map((slide) => ({
                    src: slide.src,
                    alt: getLocaleValue(messages, ["hero", "slides", slide.key]),
                }))}
            />
            <dl
                aria-label={getLocaleValue(messages, ["hero", "statsLabel"])}
                className="m-0 grid grid-cols-2 gap-x-8 gap-y-8 bg-charcoal px-5 py-10 sm:px-10 lg:col-span-2 lg:grid-cols-4 lg:px-24 xl:px-40"
            >
                {STATS.map((key) => (
                    <div key={key} className="m-0 flex flex-col gap-2">
                        <dt className="order-2 m-0 text-base leading-snug font-normal text-cream/75">
                            {getLocaleValue(messages, ["hero", "stats", key, "label"])}
                        </dt>
                        <dd className="order-1 m-0 font-display text-5xl leading-none font-semibold text-gold tabular-nums sm:text-6xl">
                            {getLocaleValue(messages, ["hero", "stats", key, "value"])}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
