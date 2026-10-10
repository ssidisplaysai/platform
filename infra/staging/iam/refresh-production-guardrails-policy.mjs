import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isApprovedPreviousProductionGuardrailsPolicy,
  readAndValidateProductionGuardrailsPolicy,
} from "./validate-production-guardrails-policy.mjs";

export const EXPECTED_ACCOUNT = "452630323448";
export const GUARDRAIL_POLICY_ARN =
  "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-04-production-guardrails-deny";
export const ROLE_NAME = "GenesisGitHubDeployRole";

function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize).sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, normalize(value[key])]),
    );
  }
  return value;
}

function documentsEqual(left, right) {
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function documentFromResponse(response, description) {
  const document = response?.PolicyVersion?.Document ?? response;
  if (typeof document === "string") {
    const candidates = [document];
    try {
      const decoded = decodeURIComponent(document);
      if (decoded !== document) candidates.push(decoded);
    } catch {
      // The unmodified candidate may still contain plain JSON.
    }
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch {
        // Try the next documented AWS CLI representation.
      }
    }
    throw new Error(`${description} returned an invalid policy document`);
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`${description} returned no policy document`);
  }
  return document;
}

export async function refreshProductionGuardrailsPolicy({
  aws,
  policyFile,
  policyFileUri,
  report = console.log,
}) {
  if (typeof aws !== "function") throw new Error("AWS command adapter is required");
  const repositoryDocument = await readAndValidateProductionGuardrailsPolicy(policyFile);

  const identity = await aws(["sts", "get-caller-identity", "--output", "json"]);
  if (identity.Account !== EXPECTED_ACCOUNT) {
    throw new Error(`expected AWS account ${EXPECTED_ACCOUNT}; refusing to continue`);
  }

  await aws(["iam", "get-role", "--role-name", ROLE_NAME, "--output", "json"]);
  const inline = await aws([
    "iam", "list-role-policies", "--role-name", ROLE_NAME, "--output", "json",
  ]);
  if (!Array.isArray(inline.PolicyNames) || inline.PolicyNames.length !== 0) {
    throw new Error(`${ROLE_NAME} must have zero inline policies`);
  }

  const attached = await aws([
    "iam", "list-attached-role-policies", "--role-name", ROLE_NAME, "--output", "json",
  ]);
  if (
    !Array.isArray(attached.AttachedPolicies) ||
    !attached.AttachedPolicies.some((policy) => policy.PolicyArn === GUARDRAIL_POLICY_ARN)
  ) {
    throw new Error(`policy 04 is not attached to ${ROLE_NAME}; refusing to attach it`);
  }

  const metadata = await aws([
    "iam", "get-policy", "--policy-arn", GUARDRAIL_POLICY_ARN, "--output", "json",
  ]);
  const versionId = metadata?.Policy?.DefaultVersionId;
  if (typeof versionId !== "string" || versionId.length === 0) {
    throw new Error("policy 04 has no readable default version");
  }
  const readActiveDocument = async (id) => documentFromResponse(
    await aws([
      "iam",
      "get-policy-version",
      "--policy-arn",
      GUARDRAIL_POLICY_ARN,
      "--version-id",
      id,
      "--query",
      "PolicyVersion.Document",
      "--output",
      "json",
    ]),
    `policy 04 version ${id}`,
  );

  const activeDocument = await readActiveDocument(versionId);
  if (documentsEqual(repositoryDocument, activeDocument)) {
    report(`POLICY_ALREADY_CURRENT=${GUARDRAIL_POLICY_ARN} VERSION=${versionId}`);
  } else {
    if (!isApprovedPreviousProductionGuardrailsPolicy(activeDocument)) {
      throw new Error(
        "active policy 04 differs from both the exact reviewed pre-refresh baseline and repository target; refusing a potentially protection-reducing update",
      );
    }
    const versions = await aws([
      "iam", "list-policy-versions", "--policy-arn", GUARDRAIL_POLICY_ARN, "--output", "json",
    ]);
    if (!Array.isArray(versions.Versions)) {
      throw new Error("policy 04 version inventory is invalid");
    }
    if (versions.Versions.length >= 5) {
      report("GUARDRAIL_POLICY_VERSION_LIMIT_REACHED");
      throw new Error("GUARDRAIL_POLICY_VERSION_LIMIT_REACHED");
    }
    if (typeof policyFileUri !== "string" || !policyFileUri.startsWith("file://")) {
      throw new Error("policy 04 document must use the shared AWS CLI file URI helper");
    }
    const created = await aws([
      "iam",
      "create-policy-version",
      "--policy-arn",
      GUARDRAIL_POLICY_ARN,
      "--policy-document",
      policyFileUri,
      "--set-as-default",
      "--output",
      "json",
    ]);
    const createdVersion = created?.PolicyVersion?.VersionId;
    if (typeof createdVersion !== "string" || createdVersion.length === 0) {
      throw new Error("AWS did not return the created policy 04 version id");
    }
    report(`POLICY_VERSION_CREATED=${GUARDRAIL_POLICY_ARN} VERSION=${createdVersion}`);
  }

  const updatedMetadata = await aws([
    "iam", "get-policy", "--policy-arn", GUARDRAIL_POLICY_ARN, "--output", "json",
  ]);
  const updatedVersionId = updatedMetadata?.Policy?.DefaultVersionId;
  if (typeof updatedVersionId !== "string" || updatedVersionId.length === 0) {
    throw new Error("updated policy 04 has no readable default version");
  }
  const verifiedDocument = await readActiveDocument(updatedVersionId);
  if (!documentsEqual(repositoryDocument, verifiedDocument)) {
    throw new Error("active policy 04 does not exactly match the strictly validated repository document");
  }
  report(`PRODUCTION_GUARDRAILS_POLICY=PASS VERSION=${updatedVersionId}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [policyFile, policyFileUri] = process.argv.slice(2);
  if (!policyFile || !policyFileUri) {
    console.error("usage: node refresh-production-guardrails-policy.mjs <policy-file> <file-uri>");
    process.exitCode = 2;
  } else {
    try {
      await refreshProductionGuardrailsPolicy({
        aws: async (args) => {
          const result = spawnSync("aws", args, { encoding: "utf8", windowsHide: true });
          if (result.error || result.status !== 0) {
            const detail = result.stderr?.trim() || result.error?.message || `exit ${result.status}`;
            throw new Error(`AWS ${args.slice(0, 2).join(" ")} failed: ${detail}`);
          }
          try {
            return JSON.parse(result.stdout);
          } catch (error) {
            throw new Error(`AWS ${args.slice(0, 2).join(" ")} returned invalid JSON`, { cause: error });
          }
        },
        policyFile,
        policyFileUri,
      });
    } catch (error) {
      console.error(`PRODUCTION_GUARDRAILS_POLICY=FAIL ${error.message}`);
      process.exitCode = 1;
    }
  }
}
