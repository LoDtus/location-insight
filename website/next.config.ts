import fs from "fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const markdownLoader = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "loaders/md-raw-loader.cjs",
);

const { loadRootEnv } = createRequire(import.meta.url)(
    "./scripts/load-root-env.cjs",
) as { loadRootEnv: () => string };

loadRootEnv();

const isDocker = fs.existsSync("/.dockerenv");
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
    output: "standalone",
    reactCompiler: true,
    poweredByHeader: false,
    trailingSlash: false,
    agentRules: false,
    turbopack: {
        rules: {
            "*.md": {
                loaders: [markdownLoader],
                as: "*.js",
            },
        },
    },
    ...(isProduction
        ? {}
        : {
              allowedDevOrigins: ["localhost", "127.0.0.1"],
              // Next không proxy WebSocket: ở dev trình duyệt nối thẳng cổng backend.
              env: { REALTIME_BACKEND_PORT: process.env.BACKEND_PORT || "22370" },
          }),
    async rewrites() {
        const prefix = process.env.GLOBAL_PREFIX || "api/v1";
        const port = process.env.BACKEND_PORT || "22370";
        const target =
            process.env.API_PROXY_TARGET || `http://127.0.0.1:${port}`;

        return [
            {
                source: `/${prefix}/:path*`,
                destination: `${target}/${prefix}/:path*`,
            },
        ];
    },
    webpack: (config, { dev }) => {
        config.module.rules.push({
            test: /\.md$/,
            use: [markdownLoader],
        });

        if (dev && isDocker) {
            config.watchOptions = {
                poll: 1000,
                aggregateTimeout: 300,
                ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
            };
        }

        return config;
    },
};

export default nextConfig;
