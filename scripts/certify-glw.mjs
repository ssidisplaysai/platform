import { spawnSync } from "node:child_process";

const steps = [
  ["diff-check", "git", ["diff", "--check"]],
  ["typecheck", "npm", ["run", "typecheck:production"]],
  [
    "glw-tests",
    "npx",
    [
      "jest",
      "src/modules/glw/__tests__/generated-content-qa.test.ts",
      "src/modules/glw/__tests__/page-execution-recovery.test.ts",
      "src/modules/glw/__tests__/target-preflight.test.ts",
      "--runInBand",
    ],
  ],
  ["build", "npm", ["run", "build"]],
];

const summary = [];

for (const [name, command, args] of steps) {
  const startedAt = Date.now();
  console.log(`\n=== ${name.toUpperCase()} ===`);

  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  const elapsedMs = Date.now() - startedAt;
  const exitCode = result.status ?? 1;
  const ok = exitCode === 0;

  summary.push({ name, ok, exitCode, elapsedMs });

  if (!ok) {
    console.error(`\nGLW_CERTIFICATION=FAIL step=${name} exit=${exitCode}`);
    console.log(JSON.stringify({ ok: false, steps: summary }, null, 2));
    process.exit(exitCode || 1);
  }
}

console.log("\n=== GLW CERTIFICATION SUMMARY ===");
for (const step of summary) {
  console.log(`${step.name}=PASS (${step.elapsedMs}ms)`);
}

console.log("GLW_CERTIFICATION=PASS");
console.log(JSON.stringify({ ok: true, steps: summary }, null, 2));
