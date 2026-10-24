import { getLocaleValue } from "@/shared/utils/locale.utils";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";

export default async function Footer() {
    const messages = await getLandingMessages();

    return (
        <nav
            aria-label={getLocaleValue(messages, ["footerNav"])}
            className="mx-auto flex w-full max-w-960 flex-wrap items-center gap-x-2 gap-y-1 px-50"
        >
            <span className="inline-flex min-h-11 items-center px-2 py-1">
                {getLocaleValue(messages, ["sections", "legal"])}
            </span>
        </nav>
    );
}
