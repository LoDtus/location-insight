const LANDING_PAGE_SEO = {
    ROUTES: {
        home: "/",
        properties: "/nha-dat",
        articles: "/bai-viet",
    },
} as const;

export type LandingPagePath =
    (typeof LANDING_PAGE_SEO.ROUTES)[keyof typeof LANDING_PAGE_SEO.ROUTES];

export default LANDING_PAGE_SEO;
