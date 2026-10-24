import ENV from "@/shared/constants/env.constant";
import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function HeroSection() {
    const messages = await getLandingMessages();
    const label = getLocaleValue(messages, ["sections", "intro"]);

    return (
        <section
            id="gioi-thieu"
            aria-label={label}
            className="box-border min-h-[100cqh] border border-current px-50 py-4"
        >
            <h1 className="m-0">{ENV.APP_NAME}</h1>
        </section>
    );
}
