import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = resolve(import.meta.dirname, "staging-s2g-db-admin-authorization-prepare.ps1");
const baseTemplate = {
  TableName: "genesis-staging-s2g-db-admin-diagnostic-launches",
  ConditionExpression: "attribute_not_exists(runId)",
  Item: {
    runId: { S: "s2g-dbdiag-template-abc" },
    launchState: { S: "AUTHORIZED" },
    approvedDiagnosticTaskDefinitionArn: { S: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:1" },
    approvedClusterArn: { S: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production" },
    approvedDiagnosticImageDigest: { S: "sha256:4603f32f34be3dcf4c4c80fee1c521d2427fc95b54d6e031fb0fa868143be7b5" },
    approvedNetworkIdentity: { S: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production|subnet-0f303dea5f645e42d,subnet-00a0b287895a3b18c|sg-0e9dcd277642bdb63" },
    authorizedOperatorArn: { S: "arn:aws:sts::452630323448:assumed-role/OperatorSession/example" },
    authorizationCreatorArn: { S: "arn:aws:sts::452630323448:assumed-role/CreatorSession/example" },
    expectedAccountId: { S: "452630323448" },
    expectedRegion: { S: "us-west-2" },
    purpose: { S: "STAGING_DB_ADMIN_READONLY_DIAGNOSTIC" },
    schemaVersion: { S: "2026-10-13" },
    createdAtEpoch: { N: "1760459400" },
    expiresAtEpoch: { N: "1760459700" },
    maxLaunchAttempts: { N: "1" },
    approvalReference: { S: "APPROVAL-REF-1" },
  },
};

const isWindows = process.platform === "win32";

function runPrepare({
  templatePath,
  outputPath,
  runId = "s2g-dbdiag-offline-abc123",
  operatorArn = "arn:aws:sts::452630323448:assumed-role/GenesisStagingS2gDbAdminD-StagingS2gDbAdminDiagnost-zeoxqigBe1Ma/session-001",
  creatorArn = "arn:aws:sts::452630323448:assumed-role/genesis-staging-s2g-db-admin-authorization-writer-role/session-creator-001",
  approvalReference = "S2G-DBDIAG-APPROVAL-NEW-001",
  createdAtEpoch = String(Math.floor(Date.now() / 1000)),
  expiresAtEpoch = String(Math.floor(Date.now() / 1000) + 300),
}) {
  if (!isWindows) return { status: 0, stdout: "", stderr: "" };
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-TemplatePath",
    templatePath,
    "-OutputPath",
    outputPath,
    "-RunId",
    runId,
    "-AuthorizedOperatorArn",
    operatorArn,
    "-AuthorizationCreatorArn",
    creatorArn,
    "-ApprovalReference",
    approvalReference,
    "-CreatedAtEpoch",
    createdAtEpoch,
    "-ExpiresAtEpoch",
    expiresAtEpoch,
  ];
  const result = spawnSync("powershell.exe", args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

async function withTempDir(fn) {
  const directory = await mkdtemp(resolve(tmpdir(), "s2g-db-admin-auth-prepare-"));
  try {
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (!isWindows) {
  test("powershell preparation script tests require Windows", { skip: true }, () => {});
} else {
  test("prepares valid no-BOM request and never emits BOM bytes", async () => {
    await withTempDir(async (directory) => {
      const templatePath = resolve(directory, "template.json");
      const outputPath = resolve(directory, "request.json");
      await writeFile(templatePath, JSON.stringify(baseTemplate, null, 2), "utf8");
      const result = runPrepare({ templatePath, outputPath });
      assert.equal(result.status, 0, result.stderr);
      const bytes = await readFile(outputPath);
      assert.notDeepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
      const parsed = JSON.parse(bytes.toString("utf8"));
      assert.equal(parsed.TableName, baseTemplate.TableName);
      assert.equal(parsed.ConditionExpression, "attribute_not_exists(runId)");
      assert.equal(parsed.Item.maxLaunchAttempts.N, "1");
      assert.match(result.stdout, /"awsExecutionPermitted"\s*:\s*false/);
    });
  });

  test("normalizes BOM-prefixed template input into BOM-free output", async () => {
    await withTempDir(async (directory) => {
      const templatePath = resolve(directory, "template-bom.json");
      const outputPath = resolve(directory, "request.json");
      const bomPrefixed = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(JSON.stringify(baseTemplate), "utf8")]);
      await writeFile(templatePath, bomPrefixed);
      const result = runPrepare({ templatePath, outputPath });
      assert.equal(result.status, 0, result.stderr);
      const bytes = await readFile(outputPath);
      assert.notDeepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
      assert.match(result.stdout, /"templateHadUtf8Bom"\s*:\s*true/);
    });
  });

  test("rejects invalid payloads and arguments fail-closed", async () => {
    await withTempDir(async (directory) => {
      const makeTemplate = async (name, mutate) => {
        const template = JSON.parse(JSON.stringify(baseTemplate));
        mutate(template);
        const path = resolve(directory, name);
        await writeFile(path, JSON.stringify(template, null, 2), "utf8");
        return path;
      };
      const outputPath = resolve(directory, "request.json");

      const invalidType = await makeTemplate("invalid-type.json", (template) => {
        template.Item.maxLaunchAttempts = { S: "1" };
      });
      const invalidTypeResult = runPrepare({ templatePath: invalidType, outputPath });
      assert.notEqual(invalidTypeResult.status, 0);
      assert.match(invalidTypeResult.stderr, /PREP_ATTRIBUTE_TYPE_INVALID/);

      const wrongTable = await makeTemplate("wrong-table.json", (template) => {
        template.TableName = "other-table";
      });
      const wrongTableResult = runPrepare({ templatePath: wrongTable, outputPath });
      assert.notEqual(wrongTableResult.status, 0);
      assert.match(wrongTableResult.stderr, /PREP_TABLE_NAME_INVALID/);

      const missingCondition = await makeTemplate("missing-condition.json", (template) => {
        delete template.ConditionExpression;
      });
      const missingConditionResult = runPrepare({ templatePath: missingCondition, outputPath });
      assert.notEqual(missingConditionResult.status, 0);
      assert.match(missingConditionResult.stderr, /PREP_CONDITION_INVALID/);

      const wrongDigest = await makeTemplate("wrong-digest.json", (template) => {
        template.Item.approvedDiagnosticImageDigest = { S: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
      });
      const wrongDigestResult = runPrepare({ templatePath: wrongDigest, outputPath });
      assert.notEqual(wrongDigestResult.status, 0);
      assert.match(wrongDigestResult.stderr, /PREP_IMAGE_DIGEST_INVALID/);

      const wrongAttempts = await makeTemplate("wrong-attempts.json", (template) => {
        template.Item.maxLaunchAttempts = { N: "2" };
      });
      const wrongAttemptsResult = runPrepare({ templatePath: wrongAttempts, outputPath });
      assert.notEqual(wrongAttemptsResult.status, 0);
      assert.match(wrongAttemptsResult.stderr, /PREP_MAX_ATTEMPTS_INVALID/);

      const wrongRunIdTemplate = await makeTemplate("wrong-runid-template.json", () => {});
      const wrongRunIdResult = runPrepare({
        templatePath: wrongRunIdTemplate,
        outputPath,
        runId: "invalid-prefix-run-id",
      });
      assert.notEqual(wrongRunIdResult.status, 0);
      assert.match(wrongRunIdResult.stderr, /PREP_RUN_ID_INVALID/);

      const wrongOperatorArnTemplate = await makeTemplate("wrong-operator-template.json", () => {});
      const wrongOperatorArnResult = runPrepare({
        templatePath: wrongOperatorArnTemplate,
        outputPath,
        operatorArn: "arn:aws:iam::452630323448:role/not-assumed-role",
      });
      assert.notEqual(wrongOperatorArnResult.status, 0);
      assert.match(wrongOperatorArnResult.stderr, /PREP_OPERATOR_ARN_INVALID/);

      const invalidExpiryTemplate = await makeTemplate("invalid-expiry-template.json", () => {});
      const invalidExpiryResult = runPrepare({
        templatePath: invalidExpiryTemplate,
        outputPath,
        createdAtEpoch: String(Math.floor(Date.now() / 1000)),
        expiresAtEpoch: String(Math.floor(Date.now() / 1000) + 301),
      });
      assert.notEqual(invalidExpiryResult.status, 0);
      assert.match(invalidExpiryResult.stderr, /PREP_EXPIRY_WINDOW_INVALID/);

      const missingApprovalTemplate = await makeTemplate("missing-approval-template.json", () => {});
      const missingApprovalResult = runPrepare({
        templatePath: missingApprovalTemplate,
        outputPath,
        approvalReference: "<<approved-change-ticket-or-runbook-id>>",
      });
      assert.notEqual(missingApprovalResult.status, 0);
      assert.match(missingApprovalResult.stderr, /PREP_APPROVAL_REFERENCE_REQUIRED/);
    });
  });

  test("contains no aws CLI invocation path", async () => {
    const source = await readFile(scriptPath, "utf8");
    assert.doesNotMatch(source, /\baws(\.exe)?\s+[a-z]/i);
    assert.doesNotMatch(source, /\bInvoke-RestMethod\b/i);
    assert.doesNotMatch(source, /\bStart-Process\b/i);
    assert.match(source, /mode = "offline-prepare-only"/);
  });
}
