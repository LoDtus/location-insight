import LANDING_PAGE_SEO from "@/features/landing-page/constants/landing-page-seo.constant";

const INDEXABLE_PATHS = new Set<string>(
    Object.values(LANDING_PAGE_SEO.ROUTES),
);

export function normalizePathname(pathname: string): string {
    if (pathname.length > 1 && pathname.endsWith("/")) {
        return pathname.slice(0, -1);
    }

    return pathname;
}

export function isIndexablePath(pathname: string): boolean {
    return INDEXABLE_PATHS.has(normalizePathname(pathname));
}
