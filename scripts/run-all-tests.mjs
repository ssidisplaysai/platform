import { spawnSync } from "node:child_process";

const npmCmd = "npm";
const smokeMode = process.argv.includes("--smoke");
const steps = smokeMode
  ? ["test:jest:smoke", "test:node:smoke", "test:compiler:smoke"]
  : ["test:jest", "test:node", "test:compiler"];

let overallStatus = 0;

for (const step of steps) {
  console.log(`\n[test:all] Running ${step}${smokeMode ? " (smoke)" : ""}`);
  const result = spawnSync(npmCmd, ["run", "--silent", step], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`[test:all] Failed to execute ${step}: ${result.error.message}`);
    overallStatus = 1;
    continue;
  }

  if ((result.status ?? 1) !== 0) {
    overallStatus = overallStatus === 0 ? result.status ?? 1 : overallStatus;
  }
}

process.exit(overallStatus);
