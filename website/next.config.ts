import fs from "fs";
import type { NextConfig } from "next";

const isDocker = fs.existsSync("/.dockerenv");
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
    output: "standalone",
    reactCompiler: true,
    poweredByHeader: false,
    trailingSlash: false,
    agentRules: false,
    turbopack: {},
    ...(isProduction
        ? {}
        : {
              allowedDevOrigins: ["localhost", "127.0.0.1"],
          }),
    webpack: (config, { dev }) => {
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
