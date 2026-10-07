import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");
const provisionPath = resolve(repoRoot, "infra/staging/provision.sh");
const bashCandidates = process.platform === "win32"
  ? [
    process.env.BASH,
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  ]
  : ["bash"];
const bashPath = bashCandidates.find((candidate) =>
  candidate && (!candidate.includes("\\") || existsSync(candidate))
) ?? "bash";

async function ensureSgHarness(createBehavior) {
  const source = await readFile(provisionPath, "utf8");
  const functionMatch = /^ensure_sg\(\) \{[\s\S]*?(?=^sg_has_ingress\()/m.exec(source);
  assert.ok(functionMatch, "provision.sh must define ensure_sg");

  const harness = [
    "set -euo pipefail",
    'MODE="apply"',
    'VPC_ID="vpc-05035503df7e142d6"',
    'lookup_sg_id() { printf "\\n"; }',
    `aws() { ${createBehavior}; }`,
    functionMatch[0],
    'STAGING_SG_ID="$(ensure_sg "genesis-staging-web-sg" "test")"',
    'aws ec2 authorize-security-group-ingress --group-id "$STAGING_SG_ID"',
  ].join("\n");
  return { source, result: spawnSync(bashPath, ["-c", harness], { encoding: "utf8" }) };
}

test("empty or malformed CreateSecurityGroup IDs stop before ingress authorization", async (t) => {
  for (const [label, behavior] of [
    ["empty ID", 'if [[ "$2" == "create-security-group" ]]; then printf "None\\n"; return 0; fi; printf "unexpected AWS command: %s\\n" "$*" >&2; return 2'],
    ["malformed ID", 'if [[ "$2" == "create-security-group" ]]; then printf "not-a-security-group-id\\n"; return 0; fi; printf "unexpected AWS command: %s\\n" "$*" >&2; return 2'],
  ]) {
    await t.test(label, async () => {
      const { source, result } = await ensureSgHarness(behavior);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /STAGING_SECURITY_GROUP_CREATE=FAIL/);
      assert.doesNotMatch(result.stdout + result.stderr, /authorize-security-group-ingress/);

      const createResultAssignment = source.indexOf('STAGING_SG_ID="$(ensure_sg');
      const ingressMutation = source.indexOf("aws ec2 authorize-security-group-ingress");
      assert.ok(createResultAssignment >= 0 && ingressMutation > createResultAssignment);
    });
  }
});

test("CreateSecurityGroup AWS failure preserves the original error and stops downstream ingress", async () => {
  const behavior = 'if [[ "$2" == "create-security-group" ]]; then echo "UnauthorizedOperation: denied by IAM" >&2; return 255; fi; printf "unexpected AWS command: %s\\n" "$*" >&2; return 2';
  const { result } = await ensureSgHarness(behavior);
  assert.equal(result.status, 255);
  assert.match(result.stderr, /UnauthorizedOperation: denied by IAM/);
  assert.match(result.stderr, /STAGING_SECURITY_GROUP_CREATE=FAIL/);
  assert.doesNotMatch(result.stdout + result.stderr, /authorize-security-group-ingress/);
});

test("valid CreateSecurityGroup ID preserves the successful ingress path", async () => {
  const behavior = 'if [[ "$2" == "create-security-group" ]]; then printf "sg-0123456789abcdef0\\n"; return 0; fi; if [[ "$2" == "authorize-security-group-ingress" ]]; then printf "INGRESS_ATTEMPTED:%s\\n" "$*"; return 0; fi; return 2';
  const { result } = await ensureSgHarness(behavior);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /sg-0123456789abcdef0/);
  assert.match(result.stdout, /INGRESS_ATTEMPTED:ec2 authorize-security-group-ingress --group-id sg-0123456789abcdef0/);
});
