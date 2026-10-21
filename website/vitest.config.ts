import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "server-only": path.resolve(__dirname, "./vitest.mocks/server-only.ts"),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        include: [
            "src/**/*.test.{ts,tsx}",
            "src/**/__tests__/**/*.{test,spec}.{ts,tsx}",
        ],
        exclude: ["node_modules", ".next", "dist"],
    },
});
