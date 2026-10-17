import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function shouldRollbackCandidate({ currentTaskDefinition, candidateTaskDefinition }) {
  assert(typeof currentTaskDefinition === "string" && currentTaskDefinition.length > 0, "currentTaskDefinition is required");
  assert(typeof candidateTaskDefinition === "string" && candidateTaskDefinition.length > 0, "candidateTaskDefinition is required");
  return currentTaskDefinition === candidateTaskDefinition;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (typeof value === "undefined" || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentTaskDefinition = args.current;
  const candidateTaskDefinition = args.candidate;
  if (!currentTaskDefinition || !candidateTaskDefinition) {
    throw new Error("Usage: node infra/staging/rollback-race-guard.mjs --current <task-def-arn> --candidate <task-def-arn>");
  }
  if (shouldRollbackCandidate({ currentTaskDefinition, candidateTaskDefinition })) {
    console.log("ROLLBACK_SAFE=true");
    return;
  }
  console.log("ROLLBACK_SAFE=false");
  process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
