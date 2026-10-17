import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONTAINER_NAME = "GenesisWebRuntime";
const REQUIRED_ENVIRONMENT = new Map([
  ["GLW_N8N_RECONNECT_ENABLED", "false"],
  ["GLW_N8N_NON_MUTATING_TEST", "true"],
]);
const REQUIRED_SECRET_NAME = "GLW_N8N_CALLBACK_SECRET";
const REGISTRATION_ONLY_FIELDS = new Set([
  "taskDefinitionArn",
  "revision",
  "status",
  "requiresAttributes",
  "compatibilities",
  "registeredAt",
  "registeredBy",
  "deregisteredAt",
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeForRegistration(taskDefinition) {
  const normalized = clone(taskDefinition);
  for (const field of REGISTRATION_ONLY_FIELDS) {
    delete normalized[field];
  }
  return normalized;
}

function getContainer(taskDefinition) {
  const containers = taskDefinition.containerDefinitions;
  assert(Array.isArray(containers), "Task definition is missing containerDefinitions");
  const container = containers.find((item) => item?.name === CONTAINER_NAME);
  assert(container, `Task definition does not include ${CONTAINER_NAME}`);
  return container;
}

function requireEnvironment(container, name) {
  const environment = Array.isArray(container.environment) ? container.environment : [];
  const entry = environment.find((item) => item?.name === name);
  assert(entry, `Task definition is missing required environment variable: ${name}`);
  assert(typeof entry.value === "string", `Environment variable ${name} has a non-string value`);
  return entry;
}

function requireSecret(container, name) {
  const secrets = Array.isArray(container.secrets) ? container.secrets : [];
  const entry = secrets.find((item) => item?.name === name);
  assert(entry, `Task definition is missing required secret reference: ${name}`);
  assert(typeof entry.valueFrom === "string" && entry.valueFrom.length > 0, `Secret ${name} is missing valueFrom`);
  assert(entry.valueFrom.startsWith("arn:aws:secretsmanager:"), `Secret ${name} must reference Secrets Manager`);
  return entry;
}

export function buildCandidateFromBaseline({ baselineTaskDefinition, imageUriWithDigest, gitCommit }) {
  assert(typeof imageUriWithDigest === "string" && imageUriWithDigest.length > 0, "imageUriWithDigest is required");
  assert(typeof gitCommit === "string" && gitCommit.length > 0, "gitCommit is required");

  const candidate = normalizeForRegistration(baselineTaskDefinition);
  const container = getContainer(candidate);
  container.image = imageUriWithDigest;

  requireSecret(container, REQUIRED_SECRET_NAME);

  requireEnvironment(container, "GIT_COMMIT").value = gitCommit;
  requireEnvironment(container, "GENESIS_RUNTIME_SHA").value = gitCommit;
  for (const [name, expectedValue] of REQUIRED_ENVIRONMENT.entries()) {
    requireEnvironment(container, name).value = expectedValue;
  }

  return candidate;
}

export function assertMatchesPreservedConfiguration({
  baselineTaskDefinition,
  candidateTaskDefinition,
  imageUriWithDigest,
  gitCommit,
}) {
  const expected = buildCandidateFromBaseline({ baselineTaskDefinition, imageUriWithDigest, gitCommit });
  const normalizedCandidate = normalizeForRegistration(candidateTaskDefinition);
  assert.deepEqual(normalizedCandidate, expected, "Candidate task definition drifted from approved staging baseline");
  return expected;
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

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || !["build", "validate"].includes(command)) {
    throw new Error("Usage: node infra/staging/staging-taskdef-config-guard.mjs <build|validate> --baseline <file> --image <uri> --git-commit <sha> [--candidate <file>] [--output <file>]");
  }

  const args = parseArgs(rest);
  const baselinePath = args.baseline;
  const image = args.image;
  const gitCommit = args["git-commit"];
  assert(typeof baselinePath === "string" && baselinePath.length > 0, "--baseline is required");
  assert(typeof image === "string" && image.length > 0, "--image is required");
  assert(typeof gitCommit === "string" && gitCommit.length > 0, "--git-commit is required");

  const baselineTaskDefinition = await readJson(baselinePath);
  if (command === "build") {
    const outputPath = args.output;
    assert(typeof outputPath === "string" && outputPath.length > 0, "--output is required for build");
    const candidate = buildCandidateFromBaseline({ baselineTaskDefinition, imageUriWithDigest: image, gitCommit });
    await writeFile(resolve(outputPath), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    return;
  }

  const candidatePath = args.candidate;
  assert(typeof candidatePath === "string" && candidatePath.length > 0, "--candidate is required for validate");
  const candidateTaskDefinition = await readJson(candidatePath);
  assertMatchesPreservedConfiguration({
    baselineTaskDefinition,
    candidateTaskDefinition,
    imageUriWithDigest: image,
    gitCommit,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
