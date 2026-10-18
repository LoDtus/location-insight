import LANDING_PAGE_SEO from "@/features/landing-page/constants/landing-page-seo.constant";
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

function resolveSiteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com";
}

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = resolveSiteUrl();

    return Object.values(LANDING_PAGE_SEO.ROUTES).map((path) => ({
        url: path === "/" ? baseUrl : `${baseUrl}${path}`,
        lastModified: new Date(),
    }));
}
