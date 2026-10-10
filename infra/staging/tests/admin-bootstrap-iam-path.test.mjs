import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(new URL("../aws-cli-file-path.sh", import.meta.url));
const bootstrapPath = fileURLToPath(new URL("../admin-bootstrap-iam.sh", import.meta.url));
const scopedStateValidatorPath = fileURLToPath(
  new URL("../iam/validate-scoped-role-policies.sh", import.meta.url),
);
const windowsGitBash = `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Git\\bin\\bash.exe`;
const bash = process.env.BASH ?? (
  process.platform === "win32" && existsSync(windowsGitBash) ? windowsGitBash : "bash"
);

function runPathHelper(script, inputPath, env = {}) {
  const result = spawnSync(bash, ["-c", script, "aws-cli-path-test", helperPath, inputPath], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trimEnd();
}

test("POSIX paths remain unchanged outside Git Bash/MSYS/MINGW", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'Linux'; }; cygpath() { return 99; }; source \"$1\"; aws_cli_file_path \"$2\"",
    "/workspace/Genesis V2/infra/staging/policy.json",
  );
  assert.equal(result, "/workspace/Genesis V2/infra/staging/policy.json");
});

test("Git Bash paths are converted with cygpath -w when available", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'MINGW64_NT-10.0'; }; cygpath() { test \"$1\" = -w || return 2; shift; printf '%s' \"$EXPECTED_WINDOWS_PATH\"; }; source \"$1\"; aws_cli_file_path \"$2\"",
    "/c/Users/rober/Documents/Genesis V2/policy.json",
    { EXPECTED_WINDOWS_PATH: "C:\\Users\\rober\\Documents\\Genesis V2\\policy.json" },
  );
  assert.equal(result, "C:\\Users\\rober\\Documents\\Genesis V2\\policy.json");
});

test("Git Bash path remains unchanged when cygpath is unavailable", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'MINGW64_NT-10.0'; }; command() { if [[ \"$1\" = -v && \"$2\" = cygpath ]]; then return 1; fi; builtin command \"$@\"; }; source \"$1\"; aws_cli_file_path \"$2\"",
    "/c/Users/rober/Documents/Genesis V2/policy.json",
  );
  assert.equal(result, "/c/Users/rober/Documents/Genesis V2/policy.json");
});

test("spaces in source and converted paths are preserved as one argument", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'MSYS_NT-10.0'; }; cygpath() { test \"$#\" = 2 && test \"$1\" = -w && test \"$2\" = '/c/Users/rober/Documents/Genesis V2/platform/infra/staging/01 policy.json' || return 2; printf '%s' \"$EXPECTED_WINDOWS_PATH\"; }; source \"$1\"; aws_cli_file_path \"$2\"",
    "/c/Users/rober/Documents/Genesis V2/platform/infra/staging/01 policy.json",
    { EXPECTED_WINDOWS_PATH: "C:\\Users\\rober\\Documents\\Genesis V2\\platform\\infra\\staging\\01 policy.json" },
  );
  assert.equal(
    result,
    "C:\\Users\\rober\\Documents\\Genesis V2\\platform\\infra\\staging\\01 policy.json",
  );
});

test("AWS CLI file URI is constructed from the converted path", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'MINGW64_NT-10.0'; }; cygpath() { test \"$1\" = -w || return 2; shift; printf '%s' \"$EXPECTED_WINDOWS_PATH\"; }; source \"$1\"; aws_cli_file_uri \"$2\"",
    "/c/Users/rober/Documents/Genesis V2/01 policy.json",
    { EXPECTED_WINDOWS_PATH: "C:\\Users\\rober\\Documents\\Genesis V2\\01 policy.json" },
  );
  assert.equal(result, "file://C:\\Users\\rober\\Documents\\Genesis V2\\01 policy.json");
});

test("admin IAM helper routes every AWS file URI through the shared converter", async () => {
  const { readFile } = await import("node:fs/promises");
  const helper = await readFile(new URL("../admin-bootstrap-iam.sh", import.meta.url), "utf8");
  assert.equal((helper.match(/file:\/\//g) ?? []).length, 0);
  assert.equal((helper.match(/aws_cli_file_uri "\$policy_file"/g) ?? []).length, 5);
});

test("admin IAM helper exposes a separately validated staging data policy refresh", async () => {
  const { readFile } = await import("node:fs/promises");
  const helper = await readFile(new URL("../admin-bootstrap-iam.sh", import.meta.url), "utf8");
  assert.match(helper, /--refresh-staging-data-policy/);
  assert.match(helper, /STAGING_DATA_POLICY=PASS/);
  assert.match(helper, /secretsmanager:GetSecretValue/);
  assert.match(helper, /aws_cli_file_uri "\$policy_file"/);
  assert.match(helper, /already has five versions; refusing to delete a version/);
});

test("admin IAM helper adds policy 05 without detaching the existing guardrail", async () => {
  const { readFile } = await import("node:fs/promises");
  const helper = await readFile(new URL("../admin-bootstrap-iam.sh", import.meta.url), "utf8");
  assert.match(helper, /"03-staging-data-iam"\s*\n\s*"04-production-guardrails-deny"\s*\n\s*"05-staging-postgres-provisioning"/);
  assert.match(helper, /validate-scoped-role-policies\.sh/);
  assert.match(helper, /ATTACHED_MANAGED_POLICY_COUNT=5/);
  assert.match(helper, /unable to attach policy 05 under the existing policy 04 guardrail/);
  assert.match(helper, /printf 'POLICY_ALREADY_ATTACHED=%s\\n' "\$arn"/);
  assert.equal((helper.match(/aws iam attach-role-policy/g) ?? []).length, 1);
  assert.doesNotMatch(helper, /aws iam detach-role-policy/);
  assert.match(helper, /--refresh-staging-postgres-policy/);
  assert.match(helper, /--refresh-production-guardrails-policy/);
  assert.match(helper, /refresh-production-guardrails-policy\.mjs/);
  assert.match(helper, /STAGING_POSTGRES_POLICY=PASS/);
  assert.match(helper, /iam:AWSServiceName.*rds\.amazonaws\.com/);
});

function runScopedStateValidator(policyNames, name = "attached.json") {
  const directory = mkdtemp(`${tmpdir()}\\genesis-scoped-iam-`);
  return directory.then(async (path) => {
    const attachedPath = `${path}\\${name}`;
    await writeFile(attachedPath, JSON.stringify({
      AttachedPolicies: policyNames.map((PolicyArn) => ({ PolicyArn })),
    }));
    const result = spawnSync(bash, [scopedStateValidatorPath, attachedPath], {
      encoding: "utf8",
      env: process.env,
    });
    await rm(path, { recursive: true, force: true });
    return result;
  });
}

const scopedPolicies = [
  "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-01-read-only-production-inspection",
  "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-02-staging-compute-network-auth",
  "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-03-staging-data-iam",
  "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-04-production-guardrails-deny",
  "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-05-staging-postgres-provisioning",
];
const legacyBroadPolicies = [
  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess",
  "arn:aws:iam::aws:policy/AmazonRDSFullAccess",
  "arn:aws:iam::aws:policy/AmazonECS_FullAccess",
  "arn:aws:iam::aws:policy/AmazonS3FullAccess",
  "arn:aws:iam::aws:policy/CloudWatchFullAccessV2",
];

test("scoped bootstrap accepts canonical 01-04 and final 01-05 states", async () => {
  const starting = await runScopedStateValidator(scopedPolicies.slice(0, 4));
  assert.equal(starting.status, 0, starting.stderr);
  assert.match(starting.stdout, /SCOPED_POLICY_START_STATE=01-04/);

  const final = await runScopedStateValidator(scopedPolicies);
  assert.equal(final.status, 0, final.stderr);
  assert.match(final.stdout, /SCOPED_POLICY_START_STATE=01-05/);
});

test("scoped bootstrap rejects each legacy broad policy with an explicit error", async (t) => {
  for (const policy of legacyBroadPolicies) {
    await t.test(policy.split("/").at(-1), async () => {
      const result = await runScopedStateValidator([...scopedPolicies.slice(0, 4), policy]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /FORBIDDEN_BROAD_POLICIES_ATTACHED/);
      assert.match(result.stderr, new RegExp(policy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
  }
});

test("scoped bootstrap rejects unexpected policies and every missing required policy", async (t) => {
  const unexpected = await runScopedStateValidator([
    ...scopedPolicies.slice(0, 4),
    "arn:aws:iam::452630323448:policy/UnexpectedManagedPolicy",
  ]);
  assert.notEqual(unexpected.status, 0);
  assert.match(unexpected.stderr, /SCOPED_POLICY_STATE_FAILED/);

  for (const index of [0, 1, 2]) {
    await t.test(`missing policy 0${index + 1}`, async () => {
      const result = await runScopedStateValidator(scopedPolicies.slice(0, 4).filter((_, i) => i !== index));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /SCOPED_POLICY_STATE_FAILED/);
    });
  }

  const missingGuardrail = await runScopedStateValidator(scopedPolicies.slice(0, 3));
  assert.notEqual(missingGuardrail.status, 0);
  assert.match(missingGuardrail.stderr, /PRODUCTION_GUARDRAIL_MISSING/);
});

test("normal bootstrap preserves policy 04 and attaches only policy 05", async () => {
  const { readFile } = await import("node:fs/promises");
  const helper = await readFile(bootstrapPath, "utf8");
  const policyFourValidation = helper.indexOf('bash "$POLICY_DIR/validate-scoped-role-policies.sh" "$WORK_DIR/attached-before.json"');
  const policyFiveAttachment = helper.indexOf('arn="$(policy_arn "05-staging-postgres-provisioning")"', policyFourValidation);
  const finalValidation = helper.indexOf('bash "$POLICY_DIR/validate-scoped-role-policies.sh" "$WORK_DIR/attached-after.json"');
  assert.ok(policyFourValidation >= 0 && policyFiveAttachment > policyFourValidation);
  assert.ok(finalValidation > policyFiveAttachment);
  assert.equal((helper.match(/aws iam attach-role-policy/g) ?? []).length, 1);
  assert.match(helper, /ATTACHED_MANAGED_POLICY_COUNT=5/);
  assert.match(helper, /POLICY_ALREADY_ATTACHED=/);
});
