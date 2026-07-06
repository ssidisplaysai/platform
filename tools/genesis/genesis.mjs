#!/usr/bin/env node

import { runScaffoldCommand } from "./commands/scaffold.mjs";

const [, , command, target] = process.argv;

function printHelp() {
  console.log(`
Genesis CLI

Usage:
  node tools/genesis/genesis.mjs <command> <target>

Commands:
  scaffold core-object-system
`);
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "scaffold") {
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
