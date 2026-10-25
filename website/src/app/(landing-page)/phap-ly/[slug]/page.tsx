import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LegalDocument from "@/features/legal/components/legal-document";
import {
    getLegalDocument,
    isLegalSlug,
    LEGAL_DOCUMENTS,
} from "@/features/legal/legal-documents";
import { loadLegalDocument } from "@/features/legal/load-legal-document";
import { getLegalMessages } from "@/features/legal/server/get-legal-messages";
import { INDEXABLE_ROBOTS, PRIVATE_ROBOTS } from "@/shared/constants/seo.constant";
import { getLocale } from "@/shared/services/locale.service";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export const dynamicParams = false;

export function generateStaticParams() {
    return LEGAL_DOCUMENTS.map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;

    if (!isLegalSlug(slug)) {
        notFound();
    }

    const messages = await getLegalMessages();

    return {
        title: getLocaleValue(messages, ["documents", slug, "title"]),
        description: getLocaleValue(messages, ["documents", slug, "description"]),
        robots: getLegalDocument(slug).indexable ? INDEXABLE_ROBOTS : PRIVATE_ROBOTS,
    };
}

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    if (!isLegalSlug(slug)) {
        notFound();
    }

    const locale = await getLocale();
    const [messages, markdown] = await Promise.all([
        getLegalMessages(),
        loadLegalDocument(slug, locale),
    ]);

    return (
        <LegalDocument
            title={getLocaleValue(messages, ["documents", slug, "title"])}
            markdown={markdown ?? ""}
        />
    );
}
