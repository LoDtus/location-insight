import RUNTIME from "@/shared/constants/runtime.constant";

const isProduction = process.env.NODE_ENV === "production";
const profile = isProduction ? RUNTIME.production : RUNTIME.development;

const ENV = {
    NODE_ENV: isProduction ? "production" : "development",
    APP_NAME: profile.appName,
    APP_DESCRIPTION: profile.appDescription,
    WEBSITE_PORT: profile.websitePort,
    WEBSITE_URL: profile.siteUrl,
    API_URL: profile.apiUrl,
    API_PREFIX: profile.apiPrefix,
    HOSTNAME: profile.hostname,
} as const;

export default ENV;
