import { spawnSync } from "node:child_process";
import { classifySuites } from "./test-suite-classifier.mjs";

const { jestSuites } = classifySuites();
const extraArgs = process.argv.slice(2);

if (jestSuites.length === 0) {
  console.log("[test:jest] No Jest suites discovered.");
  process.exit(0);
}

console.log(`[test:jest] Running ${jestSuites.length} suite(s).`);

const npxCmd = "npx";
const args = ["jest", "--runInBand", "--runTestsByPath", ...jestSuites, ...extraArgs];
const result = spawnSync(npxCmd, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`[test:jest] Failed to execute Jest: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
