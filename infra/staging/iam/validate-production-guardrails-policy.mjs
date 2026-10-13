import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Updating this digest requires a reviewed semantic diff and the deny-scope tests below.
export const EXPECTED_POLICY_DIGEST =
  "040fe79521c57430015a0ee3cfb515fb63091822ae5c80acda46ea21ffce811c";
export const EXPECTED_PREVIOUS_POLICY_DIGEST =
  "35ee832fb0cfd791d3b390fac561a6b2c809c8eae56240a62adaeb7712db7230";

const EXPECTED_STATEMENTS = [
  "DenyProductionEcsMutation",
  "DenyProductionEcr",
  "DenyProductionSecrets",
  "DenyProductionRdsMutation",
  "DenyGlobalInfrastructureMutation",
  "DenyProductionCloudFormationMutation",
  "DenyNonStagingTargetGroupMutation",
  "DenyProductionSecurityGroupMutation",
  "DenyProductionAndSelfRoleMutation",
  "DenyPassingProductionRoles",
  "DenyAnyPolicyOnStagingTaskRole",
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function productionGuardrailsPolicyDigest(document) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(document)))
    .digest("hex");
}

export function validateProductionGuardrailsPolicy(document) {
  if (document?.Version !== "2012-10-17" || !Array.isArray(document.Statement)) {
    throw new Error("policy 04 must be a valid IAM policy document");
  }
  if (document.Statement.some((statement) => statement.Effect !== "Deny")) {
    throw new Error("policy 04 may contain only Deny statements");
  }
  const statementIds = document.Statement.map((statement) => statement.Sid);
  if (
    statementIds.length !== EXPECTED_STATEMENTS.length ||
    new Set(statementIds).size !== statementIds.length ||
    EXPECTED_STATEMENTS.some((sid) => !statementIds.includes(sid))
  ) {
    throw new Error("policy 04 is missing, duplicating, or adding a guardrail statement");
  }

  const digest = productionGuardrailsPolicyDigest(document);
  if (digest !== EXPECTED_POLICY_DIGEST) {
    throw new Error("policy 04 differs from the strictly reviewed production deny baseline");
  }

  return digest;
}

export function isApprovedPreviousProductionGuardrailsPolicy(document) {
  return productionGuardrailsPolicyDigest(document) === EXPECTED_PREVIOUS_POLICY_DIGEST;
}

export async function readAndValidateProductionGuardrailsPolicy(filePath) {
  let document;
  try {
    document = JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`unable to read repository policy 04: ${error.message}`, { cause: error });
  }
  validateProductionGuardrailsPolicy(document);
  return document;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await readAndValidateProductionGuardrailsPolicy(process.argv[2]);
    console.log(`PRODUCTION_GUARDRAILS_POLICY_DOCUMENT=PASS SHA256=${EXPECTED_POLICY_DIGEST}`);
  } catch (error) {
    console.error(`PRODUCTION_GUARDRAILS_POLICY_DOCUMENT=FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
