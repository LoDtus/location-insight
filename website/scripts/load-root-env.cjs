const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

function applyEnvFile(file) {
    const text = fs.readFileSync(file, "utf8");

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }

        const normalized = line.startsWith("export ")
            ? line.slice("export ".length).trim()
            : line;
        const separator = normalized.indexOf("=");
        if (separator <= 0) {
            continue;
        }

        const key = normalized.slice(0, separator).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            continue;
        }
        if (process.env[key]) {
            continue;
        }

        let value = normalized.slice(separator + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

function loadRootEnv() {
    const nodeEnv =
        process.env.NODE_ENV === "production" ? "production" : "development";
    const envFile = path.join(repoRoot, `.env.${nodeEnv}`);

    if (!process.env.WEBSITE_PORT) {
        if (!fs.existsSync(envFile)) {
            throw new Error(
                `Thiếu ${envFile} và process không có WEBSITE_PORT.`,
            );
        }
        applyEnvFile(envFile);
    }

    const port = process.env.WEBSITE_PORT;
    if (!port || !/^[0-9]+$/.test(port)) {
        throw new Error(
            `WEBSITE_PORT không hợp lệ (${port ?? "undefined"}). Đặt số cổng trong ${envFile}.`,
        );
    }

    const portNumber = Number(port);
    if (portNumber < 1 || portNumber > 65535) {
        throw new Error(`WEBSITE_PORT ngoài khoảng cổng hợp lệ: ${port}`);
    }

    process.env.WEBSITE_PORT = port;
    process.env.PORT = port;
    return port;
}

module.exports = { loadRootEnv };
