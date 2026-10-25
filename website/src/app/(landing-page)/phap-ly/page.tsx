import type { Metadata } from "next";
import { Suspense } from "react";

import LegalIndex from "@/features/legal/components/legal-index";
import { LEGAL_DOCUMENTS } from "@/features/legal/legal-documents";
import type { LegalSearchItem, LegalSort } from "@/features/legal/legal-search";
import { getLegalMessages } from "@/features/legal/server/get-legal-messages";
import { getLocale } from "@/shared/services/locale.service";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export async function generateMetadata(): Promise<Metadata> {
    const messages = await getLegalMessages();

    return {
        title: getLocaleValue(messages, ["index", "title"]),
        description: getLocaleValue(messages, ["index", "lede"]),
    };
}

export default async function Page() {
    const [messages, locale] = await Promise.all([getLegalMessages(), getLocale()]);
    const items: LegalSearchItem[] = LEGAL_DOCUMENTS.map((document, order) => ({
        slug: document.slug,
        title: getLocaleValue(messages, ["documents", document.slug, "title"]),
        description: getLocaleValue(messages, [
            "documents",
            document.slug,
            "description",
        ]),
        indexable: document.indexable,
        order,
    }));
    const sorts = {
        relevance: getLocaleValue(messages, ["index", "sort", "relevance"]),
        "title-asc": getLocaleValue(messages, ["index", "sort", "title-asc"]),
        "title-desc": getLocaleValue(messages, ["index", "sort", "title-desc"]),
    } satisfies Record<LegalSort, string>;

    return (
        <Suspense
            fallback={
                <p className="m-0 px-4 py-12 text-base">
                    {getLocaleValue(messages, ["index", "loading"])}
                </p>
            }
        >
            <LegalIndex
                title={getLocaleValue(messages, ["index", "title"])}
                lede={getLocaleValue(messages, ["index", "lede"])}
                items={items}
                locale={locale}
                labels={{
                    searchLabel: getLocaleValue(messages, ["index", "searchLabel"]),
                    searchPlaceholder: getLocaleValue(messages, [
                        "index",
                        "searchPlaceholder",
                    ]),
                    sortLabel: getLocaleValue(messages, ["index", "sortLabel"]),
                    sorts,
                    resultUnit: getLocaleValue(messages, ["index", "resultUnit"]),
                    empty: getLocaleValue(messages, ["index", "empty"]),
                    clear: getLocaleValue(messages, ["index", "clear"]),
                    publicLabel: getLocaleValue(messages, ["index", "public"]),
                    internalLabel: getLocaleValue(messages, ["index", "internal"]),
                }}
            />
        </Suspense>
    );
}
