import Link from "next/link";

import {
    LEGAL_DOCUMENTS,
    LEGAL_PATH_PREFIX,
    legalDocumentPath,
} from "@/features/legal/legal-documents";
import { OPERATOR_INFO } from "@/features/legal/operator-info";
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
            <section
                aria-label={getLocaleValue(landing, ["footerContact", "title"])}
                className="text-sm text-cream/85 lg:col-span-2"
            >
                <h2 className="m-0 text-sm font-semibold text-cream">
                    {getLocaleValue(landing, ["footerContact", "title"])}
                </h2>
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-6 gap-y-1 p-0">
                    <li>
                        {getLocaleValue(landing, ["footerContact", "operator"])}:{" "}
                        {OPERATOR_INFO.name}
                    </li>
                    <li>
                        {getLocaleValue(landing, ["footerContact", "email"])}:{" "}
                        <a className="underline" href={`mailto:${OPERATOR_INFO.email}`}>
                            {OPERATOR_INFO.email}
                        </a>
                    </li>
                    <li>
                        {getLocaleValue(landing, ["footerContact", "facebook"])}:{" "}
                        <a
                            className="underline"
                            href={OPERATOR_INFO.facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {OPERATOR_INFO.facebookLabel}
                        </a>
                    </li>
                    <li>
                        {getLocaleValue(landing, ["footerContact", "zalo"])}:{" "}
                        <a className="underline" href={`tel:${OPERATOR_INFO.zaloPhone}`}>
                            {OPERATOR_INFO.zaloPhone}
                        </a>
                    </li>
                </ul>
            </section>
        </div>
    );
}
