import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function CauHoiSection() {
    const messages = await getLandingMessages();
    const title = getLocaleValue(messages, ["sections", "faq"]);

    return (
        <section
            id="cau-hoi-thuong-gap"
            aria-labelledby="tieu-de-cau-hoi-thuong-gap"
        >
            <h2 id="tieu-de-cau-hoi-thuong-gap">{title}</h2>
        </section>
    );
}
