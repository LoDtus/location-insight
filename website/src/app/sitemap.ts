import LANDING_PAGE_SEO from "@/features/landing-page/constants/landing-page-seo.constant";
import ENV from "@/shared/constants/env.constant";
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = ENV.WEBSITE_URL;

    return Object.values(LANDING_PAGE_SEO.ROUTES).map((path) => ({
        url: path === "/" ? baseUrl : `${baseUrl}${path}`,
        lastModified: new Date(),
    }));
}
