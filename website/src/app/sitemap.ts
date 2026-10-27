import LANDING_PAGE_SEO from "@/features/landing-page/constants/landing-page-seo.constant";
import { LISTINGS, listingPath } from "@/features/landing-page/data/listings";
import {
    LEGAL_DOCUMENTS,
    LEGAL_PATH_PREFIX,
    legalDocumentPath,
} from "@/features/legal/legal-documents";
import ENV from "@/shared/constants/env.constant";
import type { MetadataRoute } from "next";

export const revalidate = 3600;

async function publishedArticlePaths(): Promise<string[]> {
    const target = (process.env.API_PROXY_TARGET || `http://127.0.0.1:${process.env.BACKEND_PORT || "22370"}`).replace(
        /\/$/,
        "",
    );
    const prefix = (process.env.GLOBAL_PREFIX || "api/v1").replace(/^\/|\/$/g, "");
    const paths: string[] = [];

    try {
        for (let page = 1; page <= 20; page += 1) {
            const response = await fetch(`${target}/${prefix}/articles?page=${page}`);
            if (!response.ok) break;
            const body = (await response.json()) as {
                data?: { items?: { slug: string }[]; pageSize?: number };
            };
            const items = body.data?.items ?? [];
            paths.push(...items.map((item) => `/bai-viet/${item.slug}`));
            if (items.length < (body.data?.pageSize ?? 6)) break;
        }
    } catch {
        return paths;
    }

    return paths;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = ENV.WEBSITE_URL;
    const paths = [
        ...Object.values(LANDING_PAGE_SEO.ROUTES),
        LEGAL_PATH_PREFIX,
        ...LEGAL_DOCUMENTS.filter((document) => document.indexable).map(
            (document) => legalDocumentPath(document.slug),
        ),
        ...LISTINGS.map((listing) => listingPath(listing)),
        ...(await publishedArticlePaths()),
    ];

    return paths.map((path) => ({
        url: path === "/" ? baseUrl : `${baseUrl}${path}`,
        lastModified: new Date(),
    }));
}
