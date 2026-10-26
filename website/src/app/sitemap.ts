import LANDING_PAGE_SEO from "@/features/landing-page/constants/landing-page-seo.constant";
import { LISTINGS } from "@/features/landing-page/data/listings";
import {
    LEGAL_DOCUMENTS,
    LEGAL_PATH_PREFIX,
    legalDocumentPath,
} from "@/features/legal/legal-documents";
import ENV from "@/shared/constants/env.constant";
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = ENV.WEBSITE_URL;
    const paths = [
        ...Object.values(LANDING_PAGE_SEO.ROUTES),
        LEGAL_PATH_PREFIX,
        ...LEGAL_DOCUMENTS.filter((document) => document.indexable).map(
            (document) => legalDocumentPath(document.slug),
        ),
        ...LISTINGS.map((listing) => `/nha-dat/${listing.id}`),
    ];

    return paths.map((path) => ({
        url: path === "/" ? baseUrl : `${baseUrl}${path}`,
        lastModified: new Date(),
    }));
}
