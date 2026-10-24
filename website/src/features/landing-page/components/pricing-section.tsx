import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function BangGiaSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "pricing"]);

    return (
        <section id="bang-gia" aria-labelledby="tieu-de-bang-gia">
            <h2 id="tieu-de-bang-gia">{title}</h2>
        </section>
    );
}
