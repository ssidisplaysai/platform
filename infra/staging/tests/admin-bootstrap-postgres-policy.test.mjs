import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const policyPath = join(repoRoot, "infra/staging/iam/05-staging-postgres-provisioning.json");
const guardrailsPath = join(repoRoot, "infra/staging/iam/04-production-guardrails-deny.json");
const validatorPath = join(repoRoot, "infra/staging/iam/validate-staging-postgres-policy.mjs");
const helperPath = join(repoRoot, "infra/staging/admin-bootstrap-iam.sh");
const kmsKeyArn = "arn:aws:kms:us-west-2:452630323448:key/1dc17669-f1bc-418f-b266-ee8f3612d30a";
const kmsStatementSid = "DescribeSecretsManagerDefaultKeyForRdsManagedMasterPassword";

async function readJson(path) {
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
}

async function runValidator(policy) {
  const directory = await mkdtemp(join(tmpdir(), "postgres-policy-validation-"));
  try {
    const candidatePath = join(directory, "policy.json");
    await writeFile(candidatePath, JSON.stringify(policy), "utf8");
    return spawnSync(process.execPath, [validatorPath, candidatePath], { encoding: "utf8" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function kmsStatement(policy) {
  return policy.Statement.find((statement) => statement.Sid === kmsStatementSid);
}

test("current approved PostgreSQL policy passes the bootstrap validator", async () => {
  const policy = await readJson(policyPath);
  const helper = await readFile(helperPath, "utf8");
  const result = await runValidator(policy);

  assert.equal(result.status, 0, result.stderr);
  assert.match(helper, /validate-staging-postgres-policy\.mjs/);
  assert.equal(kmsStatement(policy).Action, "kms:DescribeKey");
  assert.equal(kmsStatement(policy).Resource, kmsKeyArn);
});

test("bootstrap validator rejects removal of the approved KMS describe statement", async () => {
  const policy = await readJson(policyPath);
  policy.Statement = policy.Statement.filter((statement) => statement.Sid !== kmsStatementSid);
  const result = await runValidator(policy);
  assert.notEqual(result.status, 0);
});

for (const [description, resource] of [
  ["wildcard resource", "*"],
  ["RDS default key", "arn:aws:kms:us-west-2:452630323448:key/72fb6bfd-b36b-413a-9936-0030a4d95728"],
  ["arbitrary KMS key", "arn:aws:kms:us-west-2:452630323448:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
]) {
  test(`bootstrap validator rejects KMS DescribeKey on ${description}`, async () => {
    const policy = await readJson(policyPath);
    kmsStatement(policy).Resource = resource;
    const result = await runValidator(policy);
    assert.notEqual(result.status, 0);
  });
}

for (const action of [
  "kms:Decrypt",
  "kms:Encrypt",
  "kms:GenerateDataKey",
  "kms:CreateGrant",
]) {
  test(`bootstrap validator rejects additional ${action}`, async () => {
    const policy = await readJson(policyPath);
    const statement = clone(kmsStatement(policy));
    statement.Sid = `Unexpected${action.replace("kms:", "")}`;
    statement.Action = action;
    policy.Statement.push(statement);
    const result = await runValidator(policy);
    assert.notEqual(result.status, 0);
  });
}

test("Policy 04 remains byte-for-byte unchanged", async () => {
  const source = await readFile(guardrailsPath);
  const digest = createHash("sha256").update(source).digest("hex").toUpperCase();
  assert.equal(digest, "FF526118550E0A560403501BDCBF7BF29AF122CAB55511219560788289F79E3A");
});
