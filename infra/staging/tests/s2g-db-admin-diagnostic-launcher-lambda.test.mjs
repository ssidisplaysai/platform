import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { handler } from "../s2g-db-admin-launcher/broker/diagnostic-launcher-lambda.mjs";

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

async function withCapturedLogs(fn) {
  const original = console.log;
  const entries = [];
  console.log = (...args) => {
    entries.push(args.join(" "));
  };
  try {
    return await fn(entries);
  } finally {
    console.log = original;
  }
}

test("launcher lambda logs sanitized structured rejection with validated runId", async () => {
  await withCapturedLogs(async (entries) => {
    const response = await handler({
      requestContext: {
        requestId: "lambda-fixture-request-1",
      },
      body: JSON.stringify({ runId: "s2g-dbdiag-logfixture01" }),
    });

    assert.equal(response.statusCode, 400);
    const payload = JSON.parse(response.body);
    assert.equal(payload.outcome, "REJECTED");
    assert.equal(typeof payload.code, "string");
    assert.equal(entries.length, 1);

    const logEntry = JSON.parse(entries[0]);
    assert.equal(logEntry.eventType, "STAGING_S2G_DIAGNOSTIC_REJECTED");
    assert.equal(logEntry.requestId, "lambda-fixture-request-1");
    assert.equal(logEntry.runId, "s2g-dbdiag-logfixture01");
    assert.equal(logEntry.code, payload.code);
    assert.equal(logEntry.httpStatus, 400);
    assert.equal(typeof logEntry.timestampUtc, "string");
    assert.equal(entries[0].includes("authorization"), false);
    assert.equal(entries[0].includes("secret"), false);
  });
});

test("launcher lambda omits runId from rejection log when payload is invalid", async () => {
  await withCapturedLogs(async (entries) => {
    const response = await handler({
      requestContext: {
        requestId: "lambda-fixture-request-2",
      },
      body: JSON.stringify({ runId: "BAD_RUN_ID", extra: "field" }),
    });

    assert.equal(response.statusCode, 400);
    const payload = JSON.parse(response.body);
    assert.equal(payload.outcome, "REJECTED");
    assert.equal(entries.length, 1);

    const logEntry = JSON.parse(entries[0]);
    assert.equal(logEntry.eventType, "STAGING_S2G_DIAGNOSTIC_REJECTED");
    assert.equal(logEntry.requestId, "lambda-fixture-request-2");
    assert.equal(Object.hasOwn(logEntry, "runId"), false);
    assert.equal(logEntry.code, payload.code);
    assert.equal(logEntry.httpStatus, 400);
  });
});
