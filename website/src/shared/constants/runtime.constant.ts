const SHARED = {
    appName: "Location Insight",
    appDescription: "Khoảng giá quanh một điểm ghim tại Hà Nội.",
    apiPrefix: "/api",
    hostname: "0.0.0.0",
} as const;

const RUNTIME = {
    development: {
        ...SHARED,
        siteUrl: "http://127.0.0.1:3000",
        websitePort: 3000,
        apiUrl: "http://127.0.0.1:8000",
    },
    production: {
        ...SHARED,
        siteUrl: "https://locationinsight.vn",
        websitePort: 3000,
        apiUrl: "https://api.locationinsight.vn",
    },
} as const;

export type RuntimeProfile = (typeof RUNTIME)[keyof typeof RUNTIME];

export default RUNTIME;
