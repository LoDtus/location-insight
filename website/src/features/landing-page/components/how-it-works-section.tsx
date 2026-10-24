import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function CachHoatDongSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "how"]);

    return (
        <section id="cach-hoat-dong" aria-labelledby="tieu-de-cach-hoat-dong">
            <h2 id="tieu-de-cach-hoat-dong">{title}</h2>
        </section>
    );
}
