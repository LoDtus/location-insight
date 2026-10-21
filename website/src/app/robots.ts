import type { MetadataRoute } from "next";

import ENV from "@/shared/constants/env.constant";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: "*", allow: "/" },
        sitemap: `${ENV.WEBSITE_URL}/sitemap.xml`,
    };
}
