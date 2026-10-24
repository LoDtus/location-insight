import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function BanDoSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "map"]);

    return (
        <section id="ban-do" aria-labelledby="tieu-de-ban-do">
            <h2 id="tieu-de-ban-do">{title}</h2>
        </section>
    );
}
