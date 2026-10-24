import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function Footer() {
    const messages = await getLandingMessages();

    return (
        <nav
            aria-label={getLocaleValue(messages, ["footerNav"])}
            className="mx-auto w-full max-w-960"
        >
            <a href="/#phap-ly">{getLocaleValue(messages, ["sections", "legal"])}</a>
        </nav>
    );
}
