import LANDING_PAGE_SEO from "@/features/landing-page/constants/landing-page-seo.constant";
import {
    LEGAL_DOCUMENTS,
    LEGAL_PATH_PREFIX,
    legalDocumentPath,
} from "@/features/legal/legal-documents";

const INDEXABLE_PATHS = new Set<string>([
    ...Object.values(LANDING_PAGE_SEO.ROUTES),
    LEGAL_PATH_PREFIX,
    ...LEGAL_DOCUMENTS.filter((document) => document.indexable).map(
        (document) => legalDocumentPath(document.slug),
    ),
]);

export function normalizePathname(pathname: string): string {
    if (pathname.length > 1 && pathname.endsWith("/")) {
        return pathname.slice(0, -1);
    }

    return pathname;
}

export function isIndexablePath(pathname: string): boolean {
    return INDEXABLE_PATHS.has(normalizePathname(pathname));
}
