import Link from "next/link";

import {
    LEGAL_DOCUMENTS,
    LEGAL_PATH_PREFIX,
    legalDocumentPath,
} from "@/features/legal/legal-documents";
import { getLegalMessages } from "@/features/legal/server/get-legal-messages";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export default async function Footer() {
    const [landing, legal] = await Promise.all([
        getLandingMessages(),
        getLegalMessages(),
    ]);

    return (
        <nav
            aria-label={getLocaleValue(landing, ["footerNav"])}
            className="mx-auto flex w-full max-w-960 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-4 sm:px-8 xl:px-50"
        >
            <Link
                href={LEGAL_PATH_PREFIX}
                className="inline-flex min-h-11 items-center px-2 py-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            >
                {getLocaleValue(legal, ["index", "title"])}
            </Link>
            {LEGAL_DOCUMENTS.filter((document) => document.indexable).map(
                (document) => (
                    <Link
                        key={document.slug}
                        href={legalDocumentPath(document.slug)}
                        className="inline-flex min-h-11 items-center px-2 py-1 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
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
    );
}
