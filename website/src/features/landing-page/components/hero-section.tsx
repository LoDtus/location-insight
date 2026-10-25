import HeroSearch from "@/features/landing-page/components/hero-search";
import HeroSlides from "@/features/landing-page/components/hero-slides";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const SLIDES = [
    { src: "/images/temp-002.jpg", key: "apartment" },
    { src: "/images/temp-003.jpg", key: "garden" },
    { src: "/images/temp-004.jpg", key: "tower" },
] as const;

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
            className="box-border grid min-h-[100cqh] px-50 lg:h-[100cqh] lg:grid-cols-2"
        >
            <div className="flex flex-col justify-center py-10">
                <h1 className="m-0 max-w-[12ch] text-4xl leading-[1.05] font-semibold tracking-tight text-charcoal md:text-5xl">
                    {title}
                </h1>
                <p className="mt-4 max-w-md text-base leading-relaxed text-charcoal/75">
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
        </section>
    );
}
