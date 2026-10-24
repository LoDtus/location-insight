import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function Footer() {
    const messages = await getLandingMessages();

    return (
        <nav
            aria-label={getLocaleValue(messages, ["footerNav"])}
            className="mx-auto flex w-full max-w-960 flex-wrap items-center gap-x-2 gap-y-1 px-4 md:px-6"
        >
            <a
                className="inline-flex min-h-11 items-center px-2 py-1 text-inherit underline-offset-[0.2em] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current"
                href="/#phap-ly"
            >
                {getLocaleValue(messages, ["sections", "legal"])}
            </a>
        </nav>
    );
}
