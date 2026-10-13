import assert from "node:assert/strict";
import test from "node:test";
import { issueReaderSession, mapReaderBrokerFailureCode } from "../snapshot-export/broker/reader-session-broker-core.mjs";

function baseConfig() {
  return {
    expectedAccountId: "452630323448",
    readerRoleArn: "arn:aws:iam::452630323448:role/StagingSnapshotReaderRole",
  };
}

function baseEvent(runId = "s2g-run-abc123") {
  return {
    requestContext: {
      authorizer: {
        iam: {
          userArn: "arn:aws:sts::452630323448:assumed-role/SnapshotOperator/rober",
        },
      },
    },
    body: JSON.stringify({ runId }),
  };
}

function baseDeps(overrides = {}) {
  return {
    async getRunAuthorization(runId) {
      return {
        runId,
        status: "APPROVED",
        operatorArn: "arn:aws:sts::452630323448:assumed-role/SnapshotOperator/rober",
        readerRoleArn: "arn:aws:iam::452630323448:role/StagingSnapshotReaderRole",
      };
    },
    async assumeRole(input) {
      return {
        Credentials: {
          AccessKeyId: "ASIA....",
          SecretAccessKey: "secret",
          SessionToken: "token",
          Expiration: "2026-10-13T21:00:00.000Z",
        },
        _input: input,
      };
    },
    ...overrides,
  };
}

test("issues run-scoped reader session with fixed reconciliation tag", async () => {
  let assumeInput;
  const deps = baseDeps({
    async assumeRole(input) {
      assumeInput = input;
      return {
        Credentials: {
          AccessKeyId: "ASIA....",
          SecretAccessKey: "secret",
          SessionToken: "token",
          Expiration: "2026-10-13T21:00:00.000Z",
        },
      };
    },
  });
  const response = await issueReaderSession(baseEvent(), { config: baseConfig(), deps });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.outcome, "SESSION_ISSUED");
  assert.equal(body.scopePrefix, "exports/s2g-run-abc123/");
  assert.equal(assumeInput.roleArn, "arn:aws:iam::452630323448:role/StagingSnapshotReaderRole");
  assert.deepEqual(assumeInput.tags, [{ Key: "reconciliation-run-id", Value: "s2g-run-abc123" }]);
});

test("rejects caller-provided role or session tags", async () => {
  await assert.rejects(
    issueReaderSession(
      {
        ...baseEvent(),
        body: JSON.stringify({ runId: "s2g-run-abc123", roleArn: "arn:aws:iam::452630323448:role/Admin" }),
      },
      { config: baseConfig(), deps: baseDeps() },
    ),
    /READER_BROKER_OVERRIDE_REJECTED/,
  );
});

test("rejects unauthorized operator and cross-account caller", async () => {
  await assert.rejects(
    issueReaderSession(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getRunAuthorization(runId) {
          return {
            runId,
            status: "APPROVED",
            operatorArn: "arn:aws:sts::452630323448:assumed-role/SnapshotOperator/another",
            readerRoleArn: "arn:aws:iam::452630323448:role/StagingSnapshotReaderRole",
          };
        },
      }),
    }),
    /READER_BROKER_OPERATOR_NOT_AUTHORIZED/,
  );

  await assert.rejects(
    issueReaderSession(
      {
        ...baseEvent(),
        requestContext: {
          authorizer: {
            iam: {
              userArn: "arn:aws:sts::111111111111:assumed-role/SnapshotOperator/rober",
            },
          },
        },
      },
      { config: baseConfig(), deps: baseDeps() },
    ),
    /READER_BROKER_CROSS_ACCOUNT_DENIED/,
  );
});

test("maps failures to sanitized fixed codes", () => {
  assert.equal(mapReaderBrokerFailureCode({ code: "READER_BROKER_RUN_ID_INVALID" }), "READER_BROKER_RUN_ID_INVALID");
  assert.equal(mapReaderBrokerFailureCode(new Error("oops")), "READER_BROKER_FAILED");
});

