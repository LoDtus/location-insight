import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, ".sw-build");
const policyPath = path.join(root, "src/features/pwa/sw-policy.ts");
const swPath = path.join(root, "src/sw/sw.ts");

fs.mkdirSync(buildDir, { recursive: true });
const policy = fs
    .readFileSync(policyPath, "utf8")
    .replace(/^export /gm, "")
    .replace(/^export type /gm, "type ");
const worker = fs.readFileSync(swPath, "utf8").replace(/^\/\/\/ <reference lib="webworker" \/>\n/, "");
fs.writeFileSync(path.join(buildDir, "sw-bundle.ts"), `${policy}\n${worker}`);

execFileSync("npx", ["tsc", "-p", "tsconfig.sw.json", "--pretty", "false"], {
    cwd: root,
    stdio: "inherit",
});

const built = fs.readFileSync(path.join(buildDir, "sw-bundle.js"), "utf8");
const buildId = process.env.BUILD_ID || process.env.GITHUB_SHA || new Date().toISOString();
// Chạy qua `npm run dev` / `dev:docker` thì worker tự hủy; `build` (production) giữ đầy đủ chức năng.
const devBuild = (process.env.npm_lifecycle_event ?? "").startsWith("predev");
const output = built
    .replaceAll("__BUILD_ID__", buildId.replaceAll("\\", "").replaceAll('"', ""))
    .replaceAll("__DEV_SELF_DESTRUCT__", devBuild ? "true" : "false");
fs.writeFileSync(path.join(root, "public/sw.js"), output);
