import MapPreview from "@/features/map/components/map-preview";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export default async function BanDoSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "map"]);

    return (
        <section
            id="ban-do"
            aria-labelledby="tieu-de-ban-do"
            className="box-border flex scroll-mt-4 flex-col bg-white px-5 py-14 sm:px-10 lg:px-24 lg:py-16 xl:px-40"
        >
            <h2
                id="tieu-de-ban-do"
                className="m-0 shrink-0 font-display text-[clamp(2.25rem,1.4rem+2.8vw,4rem)] leading-none font-semibold tracking-[-0.02em]"
            >
                {title}
            </h2>
            <div className="mt-6 h-[34rem] rounded-lg border border-charcoal/15 bg-white p-2 shadow-[0_1px_2px_rgba(16,17,17,0.06),0_8px_24px_rgba(16,17,17,0.06)]">
                <MapPreview />
            </div>
        </section>
    );
}
