export const LEGAL_DOCUMENTS = [
    { slug: "dieu-khoan", indexable: true },
    { slug: "chinh-sach-bao-mat", indexable: true },
    { slug: "chinh-sach-cookie", indexable: true },
    { slug: "chinh-sach-dang-tin", indexable: true },
    { slug: "chinh-sach-thanh-toan", indexable: true },
    { slug: "tuyen-bo-du-lieu", indexable: true },
    { slug: "ban-quyen", indexable: true },
    { slug: "thuong-mai-dien-tu", indexable: false },
    { slug: "thue", indexable: false },
    { slug: "ho-so-du-lieu", indexable: false },
    { slug: "quy-trinh-van-hanh", indexable: false },
    { slug: "nguon-du-lieu", indexable: false },
    { slug: "thoa-thuan-api", indexable: false },
] as const;

export type LegalSlug = (typeof LEGAL_DOCUMENTS)[number]["slug"];

export const LEGAL_PATH_PREFIX = "/phap-ly";

export function legalDocumentPath(slug: LegalSlug): string {
    return `${LEGAL_PATH_PREFIX}/${slug}`;
}

export function isLegalSectionPath(pathname: string): boolean {
    return pathname === LEGAL_PATH_PREFIX || isLegalDocumentPath(pathname);
}

export function isLegalDocumentPath(pathname: string): boolean {
    const prefix = `${LEGAL_PATH_PREFIX}/`;

    if (!pathname.startsWith(prefix)) {
        return false;
    }

    return isLegalSlug(pathname.slice(prefix.length));
}

export function isLegalSlug(value: string): value is LegalSlug {
    return LEGAL_DOCUMENTS.some((document) => document.slug === value);
}

export function getLegalDocument(slug: LegalSlug) {
    const document = LEGAL_DOCUMENTS.find((item) => item.slug === slug);

    if (!document) {
        throw new Error(`Unknown legal document: ${slug}`);
    }

    return document;
}
