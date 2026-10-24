import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function BanDoSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "map"]);

    return (
        <section
            id="ban-do"
            aria-labelledby="tieu-de-ban-do"
            className="box-border min-h-[100cqh] border border-current p-4 md:p-6"
        >
            <h2 id="tieu-de-ban-do" className="m-0">
                {title}
            </h2>
        </section>
    );
}
