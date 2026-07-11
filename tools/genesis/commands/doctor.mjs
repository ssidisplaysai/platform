import fs from "fs";
import path from "path";

/**
 * Genesis Doctor - Workspace health and architecture validation
 *
 * Checks that the Genesis workspace has the required architecture,
 * documentation, runtime, and GDK structure.
 */
export async function runDoctorCommand() {
  const root = process.cwd();
  const checks = [];
  let issuesFound = false;

  console.log("Genesis Doctor v0.1\n");

  // Check Root / Documentation
  console.log("Workspace");
  const workspaceChecks = [
    ["GENESIS.md", "GENESIS.md"],
    ["genesis/CONSTITUTION.md", "genesis/CONSTITUTION.md"],
    ["genesis/architecture", "genesis/architecture"],
    ["genesis/language", "genesis/language"],
    ["genesis/development", "genesis/development"],
  ];

  for (const [label, checkPath] of workspaceChecks) {
    const fullPath = path.join(root, checkPath);
    const exists = fs.existsSync(fullPath);
    const status = exists ? "✔" : "✖";
    console.log(`${status} ${label}`);
    if (!exists) {
      console.log(`  Missing: ${checkPath}`);
      issuesFound = true;
    }
    checks.push(exists);
  }

  console.log("");

  // Check Architecture ADRs
  console.log("Architecture");
  const adrChecks = [
    ["ADR 0011 (Meta Model)", "docs/architecture/0011-meta-model.md"],
    ["ADR 0012 (Core Capability Model)", "docs/architecture/0012-core-capability-model.md"],
    ["ADR 0013 (Genesis Development Kit)", "docs/architecture/0013-genesis-development-kit.md"],
    ["ADR 0014 (Compilation Pipeline)", "docs/architecture/0014-genesis-compilation-pipeline.md"],
  ];

  for (const [label, checkPath] of adrChecks) {
    const fullPath = path.join(root, checkPath);
    const exists = fs.existsSync(fullPath);
    const status = exists ? "✔" : "✖";
    console.log(`${status} ${label}`);
    if (!exists) {
      console.log(`  Missing: ${checkPath}`);
      issuesFound = true;
    }
    checks.push(exists);
  }

  console.log("");

  // Check Runtime / Core
  console.log("Runtime");
  const runtimeChecks = [
    ["src/core/runtime", "src/core/runtime"],
    ["src/core/kernel", "src/core/kernel"],
    ["src/core/repositories", "src/core/repositories"],
    ["src/core/services", "src/core/services"],
    ["src/core/registry", "src/core/registry"],
    ["src/core/object", "src/core/object"],
  ];

  for (const [label, checkPath] of runtimeChecks) {
    const fullPath = path.join(root, checkPath);
    const exists = fs.existsSync(fullPath);
    const status = exists ? "✔" : "✖";
    console.log(`${status} ${label}`);
    if (!exists) {
      console.log(`  Missing: ${checkPath}`);
      issuesFound = true;
    }
    checks.push(exists);
  }

  console.log("");

  // Check GDK
  console.log("GDK");
  const gdkChecks = [
    ["CLI", "tools/genesis/genesis.mjs"],
    ["Commands", "tools/genesis/commands"],
    ["Compiler", "tools/genesis/compiler"],
    ["Planner", "tools/genesis/compiler/planner"],
    ["Templates", "tools/genesis/templates"],
    ["Registry", "tools/genesis/registry"],
    ["Utils", "tools/genesis/utils"],
    ["README", "tools/genesis/README.md"],
  ];

  for (const [label, checkPath] of gdkChecks) {
    const fullPath = path.join(root, checkPath);
    const exists = fs.existsSync(fullPath);
    const status = exists ? "✔" : "✖";
    console.log(`${status} ${label}`);
    if (!exists) {
      console.log(`  Missing: ${checkPath}`);
      issuesFound = true;
    }
    checks.push(exists);
  }

  console.log("");
  console.log("Overall Health");

  if (issuesFound) {
    console.log("✖ Issues Found");
    process.exit(1);
  } else {
    console.log("✔ Healthy");
    process.exit(0);
  }
}
