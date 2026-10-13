import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd(), true);

const required = ["GCP_FOUNDATION_PERSISTENCE_DIR", "GENESIS_CREDENTIAL_MASTER_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Secure sidecar startup blocked. Missing bindings: ${missing.join(", ")}`);
  process.exit(1);
}

const exactReleasePattern = /^[0-9a-f]{40}$/;
if (!exactReleasePattern.test(process.env.GIT_COMMIT?.trim().toLowerCase() ?? "")) {
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true,
    }).trim().toLowerCase();
    if (!exactReleasePattern.test(head)) throw new Error("Git returned an invalid commit identity.");
    process.env.GIT_COMMIT = head;
  } catch (error) {
    console.error(`Secure sidecar startup blocked. Exact Git release identity is unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exit(1);
  }
}

const port = process.argv[2] ?? "3002";
const next = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, "dev", "-p", port], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
child.on("exit", (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));