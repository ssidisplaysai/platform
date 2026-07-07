#!/usr/bin/env node

import { runScaffoldCommand } from "./commands/scaffold.mjs";
import { runDoctorCommand } from "./commands/doctor.mjs";
import { runPlanCommand } from "./commands/plan.mjs";
import { runCompileCommand } from "./commands/compile.mjs";
import { runValidateCommand } from "./commands/validate.mjs";

const [, , command, ...args] = process.argv;

function printHelp() {
  console.log(`
Genesis CLI

Usage:
  node tools/genesis/genesis.mjs <command> [options]

Commands:
  doctor                          - Run workspace health check
  plan <Entity>                   - Create a generation plan for an entity
  compile <Entity> [--write]      - Compile generation plan (--write to persist)
  validate generated <Entity>     - Validate generated entity slice
  scaffold core-object-system

Examples:
  node tools/genesis/genesis.mjs doctor
  node tools/genesis/genesis.mjs plan Customer
  node tools/genesis/genesis.mjs compile Customer
  node tools/genesis/genesis.mjs compile Customer --write
  node tools/genesis/genesis.mjs validate generated Customer
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
    const [target] = args;
    await runPlanCommand(target);
    return;
  }

  if (command === "compile") {
    const [target, ...options] = args;
    await runCompileCommand(target, options);
    return;
  }

  if (command === "validate") {
    const [target, entityName] = args;
    await runValidateCommand(target, entityName);
    return;
  }

  if (command === "scaffold") {
    const [target] = args;
    await runScaffoldCommand(target);
    return;
  }

  console.error(`Unknown Genesis command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((error) => {
  console.error("Genesis CLI failed.");
  console.error(error);
  process.exit(1);
});