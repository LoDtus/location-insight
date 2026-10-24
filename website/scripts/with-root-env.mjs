import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const { loadRootEnv } = createRequire(import.meta.url)("./load-root-env.cjs");

const args = process.argv.slice(2);
const nextArgs = args[0] === "next" ? args.slice(1) : args;
const subcommand = nextArgs[0];

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = subcommand === "dev" ? "development" : "production";
}

const port = loadRootEnv();
if (args.at(-1) === "--port") {
    args.push(port);
}

const child = spawn(args.join(" "), {
    stdio: "inherit",
    env: process.env,
    shell: true,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 1);
});
