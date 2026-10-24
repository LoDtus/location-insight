import "server-only";

import RUNTIME from "@/shared/constants/runtime.constant";

function readWebsitePort(): number {
    const raw = process.env.WEBSITE_PORT;
    if (!raw || !/^[0-9]+$/.test(raw)) {
        throw new Error(
            "WEBSITE_PORT không có trong môi trường. Đặt biến này trong .env.development hoặc .env.production ở root repo.",
        );
    }

    const port = Number(raw);
    if (port < 1 || port > 65535) {
        throw new Error(`WEBSITE_PORT ngoài khoảng cổng hợp lệ: ${raw}`);
    }

    return port;
}

const isProduction = process.env.NODE_ENV === "production";
const profile = isProduction ? RUNTIME.production : RUNTIME.development;
const websitePort = readWebsitePort();

const ENV = {
    NODE_ENV: isProduction ? "production" : "development",
    APP_NAME: profile.appName,
    APP_DESCRIPTION: profile.appDescription,
    WEBSITE_PORT: websitePort,
    WEBSITE_URL: isProduction
        ? `${profile.siteProtocol}://${profile.siteHost}`
        : `${profile.siteProtocol}://${profile.siteHost}:${websitePort}`,
    API_URL: profile.apiUrl,
    API_PREFIX: profile.apiPrefix,
    HOSTNAME: profile.hostname,
} as const;

export default ENV;
