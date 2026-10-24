import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function MuaBanNhaDatSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "listings"]);

    return (
        <section
            id="mua-ban-nha-dat"
            aria-labelledby="tieu-de-mua-ban-nha-dat"
            className="box-border min-h-[100cqh] border border-current px-50 py-4"
        >
            <h2 id="tieu-de-mua-ban-nha-dat" className="m-0">
                {title}
            </h2>
        </section>
    );
}
