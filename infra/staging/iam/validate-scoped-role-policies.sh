#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" != "1" || ! -f "$1" ]]; then
  printf 'SCOPED_POLICY_STATE_FAILED: provide the attached-policy JSON file\n' >&2
  exit 2
fi

attached_file="$1"
node - "$attached_file" <<'JS'
const fs = require("node:fs");

const prefix = "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-";
const policy01 = `${prefix}01-read-only-production-inspection`;
const policy02 = `${prefix}02-staging-compute-network-auth`;
const policy03 = `${prefix}03-staging-data-iam`;
const policy04 = `${prefix}04-production-guardrails-deny`;
const policy05 = `${prefix}05-staging-postgres-provisioning`;
const broad = new Set([
  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess",
  "arn:aws:iam::aws:policy/AmazonRDSFullAccess",
  "arn:aws:iam::aws:policy/AmazonECS_FullAccess",
  "arn:aws:iam::aws:policy/AmazonS3FullAccess",
  "arn:aws:iam::aws:policy/CloudWatchFullAccessV2",
]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

let attached;
try {
  const response = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));
  if (!Array.isArray(response.AttachedPolicies)) throw new Error("invalid AttachedPolicies array");
  attached = response.AttachedPolicies.map((policy) => policy.PolicyArn);
  if (!attached.every((arn) => typeof arn === "string")) throw new Error("invalid PolicyArn value");
} catch (error) {
  fail(`SCOPED_POLICY_STATE_FAILED: invalid attached-policy response: ${error.message}`);
}

const broadPresent = [...new Set(attached)].filter((arn) => broad.has(arn)).sort();
if (broadPresent.length > 0) {
  fail(`FORBIDDEN_BROAD_POLICIES_ATTACHED: ${broadPresent.join(", ")}`);
}

if (!attached.includes(policy04)) {
  fail(`PRODUCTION_GUARDRAIL_MISSING: ${policy04} must remain attached`);
}

const base = new Set([policy01, policy02, policy03, policy04]);
const complete = new Set([...base, policy05]);
const actual = new Set(attached);
const equals = (expected) =>
  actual.size === attached.length &&
  actual.size === expected.size &&
  [...actual].every((arn) => expected.has(arn));

if (equals(base)) {
  console.log("SCOPED_POLICY_START_STATE=01-04");
} else if (equals(complete)) {
  console.log("SCOPED_POLICY_START_STATE=01-05");
} else {
  fail(
    "SCOPED_POLICY_STATE_FAILED: expected exactly Genesis policies 01-04 or 01-05; found: " +
    [...attached].sort().join(", "),
  );
}
JS
