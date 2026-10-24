import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function PhapLySection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "legal"]);

    return (
        <section
            id="phap-ly"
            aria-labelledby="tieu-de-phap-ly"
            className="box-border min-h-[100cqh] border border-current p-4 md:p-6"
        >
            <h2 id="tieu-de-phap-ly" className="m-0">
                {title}
            </h2>
        </section>
    );
}
