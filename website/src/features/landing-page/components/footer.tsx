import Link from "next/link";

import {
    LEGAL_DOCUMENTS,
    LEGAL_PATH_PREFIX,
    legalDocumentPath,
} from "@/features/legal/legal-documents";
import { getLegalMessages } from "@/features/legal/server/get-legal-messages";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const LINK_CLASS =
    "inline-flex min-h-11 items-center text-cream/85 decoration-gold decoration-2 underline-offset-[0.4em] hover:text-cream hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export default async function Footer() {
    const [landing, legal] = await Promise.all([
        getLandingMessages(),
        getLegalMessages(),
    ]);

    return (
        <div className="mx-auto grid w-full max-w-960 gap-10 px-5 py-14 sm:px-10 lg:grid-cols-[1fr_auto] lg:items-end xl:px-24">
            <img
                src="/logos/diathe-text.svg"
                alt=""
                aria-hidden="true"
                className="h-10 w-auto justify-self-start"
            />
            <nav
                aria-label={getLocaleValue(landing, ["footerNav"])}
                className="flex flex-wrap gap-x-6 gap-y-1"
            >
                <Link href="/bai-viet" className={`${LINK_CLASS} font-semibold`}>
                    {getLocaleValue(landing, ["articles", "title"])}
                </Link>
                <Link
                    href={LEGAL_PATH_PREFIX}
                    className={`${LINK_CLASS} font-semibold`}
                >
                    {getLocaleValue(legal, ["index", "title"])}
                </Link>
                {LEGAL_DOCUMENTS.filter((document) => document.indexable).map(
                    (document) => (
                        <Link
                            key={document.slug}
                            href={legalDocumentPath(document.slug)}
                            className={`${LINK_CLASS} text-sm`}
                        >
                            {getLocaleValue(legal, [
                                "documents",
                                document.slug,
                                "title",
                            ])}
                        </Link>
                    ),
                )}
            </nav>
        </div>
    );
}
