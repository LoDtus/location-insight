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
            className="box-border flex min-h-[100cqh] flex-col bg-white px-5 py-16 sm:px-10 lg:px-24 xl:px-40"
        >
            <h2
                id="tieu-de-ban-do"
                className="m-0 shrink-0 font-display text-[clamp(2.5rem,1.5rem+3.2vw,4.5rem)] leading-none font-semibold tracking-[-0.02em]"
            >
                {title}
            </h2>
            <div className="mt-8 min-h-[32rem] flex-1 bg-white p-2">
                <MapPreview />
            </div>
        </section>
    );
}
