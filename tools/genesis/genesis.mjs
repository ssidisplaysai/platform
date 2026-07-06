#!/usr/bin/env node

import { runScaffoldCommand } from "./commands/scaffold.mjs";
import { runDoctorCommand } from "./commands/doctor.mjs";
import { runPlanCommand } from "./commands/plan.mjs";
import { runCompileCommand } from "./commands/compile.mjs";

const [, , command, ...args] = process.argv;

function printHelp() {
  console.log(`
Genesis CLI

Usage:
  node tools/genesis/genesis.mjs <command> [args...]

Commands:
  doctor                      - Run workspace health check
  plan <Entity>               - Create a generation plan for an entity
  compile <Entity> [--write]  - Compile a plan (dry-run by default)
                                --write writes placeholder artifacts under
                                generated/genesis/<Entity>/
  scaffold core-object-system
`);
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "doctor") {
    await runDoctorCommand();
    return;
  }

  if (command === "plan") {
    const target = args[0];
    await runPlanCommand(target);
    return;
  }

  if (command === "compile") {
    const target = args[0];
    const options = args.slice(1);
    await runCompileCommand(target, options);
    return;
  }

  if (command === "scaffold") {
    const target = args[0];
    await runScaffoldCommand(target);
    return;
  }

  console.error(`Unknown Genesis command: $${command}`);
  printHelp();
  process.exit(1);
}

main().catch((error) => {
  console.error("Genesis CLI failed.");
  console.error(error);
  process.exit(1);
});