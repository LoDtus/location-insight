import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function BangGiaSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "pricing"]);

    return (
        <section
            id="bang-gia"
            aria-labelledby="tieu-de-bang-gia"
            className="box-border min-h-[100cqh] border border-current p-4 md:p-6"
        >
            <h2 id="tieu-de-bang-gia" className="m-0">
                {title}
            </h2>
        </section>
    );
}
