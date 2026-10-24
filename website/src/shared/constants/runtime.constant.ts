const SHARED = {
    appName: "Location Insight",
    appDescription: "Khoảng giá quanh một điểm ghim tại Hà Nội.",
    apiPrefix: "/api",
    hostname: "0.0.0.0",
} as const;

const RUNTIME = {
    development: {
        ...SHARED,
        siteProtocol: "http",
        siteHost: "127.0.0.1",
        apiUrl: "http://127.0.0.1:8000",
    },
    production: {
        ...SHARED,
        siteProtocol: "https",
        siteHost: "location-insight.longvi.org",
        apiUrl: "https://api.locationinsight.vn",
    },
} as const;

export type RuntimeProfile = (typeof RUNTIME)[keyof typeof RUNTIME];

export default RUNTIME;
