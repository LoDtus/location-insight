import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function MuaBanNhaDatSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "listings"]);

    return (
        <section id="mua-ban-nha-dat" aria-labelledby="tieu-de-mua-ban-nha-dat">
            <h2 id="tieu-de-mua-ban-nha-dat">{title}</h2>
        </section>
    );
}
