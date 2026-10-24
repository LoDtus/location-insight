import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function PhapLySection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "legal"]);

    return (
        <section id="phap-ly" aria-labelledby="tieu-de-phap-ly">
            <h2 id="tieu-de-phap-ly">{title}</h2>
        </section>
    );
}
