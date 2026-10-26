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
            className="box-border flex min-h-[100cqh] flex-col border border-current px-50 py-4"
        >
            <h2 id="tieu-de-ban-do" className="m-0 shrink-0">
                {title}
            </h2>
            <div className="mt-4 min-h-0 flex-1">
                <MapPreview />
            </div>
        </section>
    );
}
