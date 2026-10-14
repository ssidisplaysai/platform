import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");
const launcherLambdaPath = resolve(
  repoRoot,
  "infra/staging/s2g-db-admin-launcher/broker/diagnostic-launcher-lambda.mjs",
);

test("launcher lambda claim transition requires pre-existing AUTHORIZED record and cannot upsert", async () => {
  const source = await readFile(launcherLambdaPath, "utf8");
  assert.match(source, /attribute_exists\(runId\)/);
  assert.match(source, /launchState = :authorized/);
  assert.match(source, /schemaVersion = :schemaVersion/);
  assert.match(source, /purpose = :purpose/);
  assert.match(source, /approvedDiagnosticTaskDefinitionArn = :taskArn/);
  assert.match(source, /approvedClusterArn = :clusterArn/);
  assert.match(source, /approvedDiagnosticImageDigest = :imageDigest/);
  assert.match(source, /approvedNetworkIdentity = :networkIdentity/);
  assert.match(source, /authorizedOperatorArn = :invokerArn/);
  assert.match(source, /expiresAtEpoch > :nowEpoch/);
  assert.match(source, /launchAttempts < maxLaunchAttempts/);
  assert.doesNotMatch(source, /attribute_not_exists\(runId\)\s+OR/i);
});

test("launcher lambda records terminal failure states and has no PutItem upsert path", async () => {
  const source = await readFile(launcherLambdaPath, "utf8");
  assert.match(source, /recordLaunchFailure/);
  assert.match(source, /"LAUNCH_FAILED"/);
  assert.match(source, /recordLaunchOutcomeUnknown/);
  assert.match(source, /"OUTCOME_UNKNOWN"/);
  assert.doesNotMatch(source, /PutCommand/);
  assert.doesNotMatch(source, /dynamodb:PutItem/);
});
