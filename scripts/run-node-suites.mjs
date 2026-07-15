import { spawnSync } from "node:child_process";
import { classifySuites } from "./test-suite-classifier.mjs";

const { nodeTestSuites } = classifySuites();
const nonCompilerNodeSuites = nodeTestSuites.filter(
  (suite) => !suite.startsWith("tests/compiler/core/")
);
const extraArgs = process.argv.slice(2);

if (nonCompilerNodeSuites.length === 0) {
  console.log("[test:node] No node:test suites discovered outside compiler-core.");
  process.exit(0);
}

console.log(`[test:node] Running ${nonCompilerNodeSuites.length} suite(s).`);

const npxCmd = "npx";
const args = ["tsx", "--test", ...nonCompilerNodeSuites, ...extraArgs];
const result = spawnSync(npxCmd, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`[test:node] Failed to execute node:test suites: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
