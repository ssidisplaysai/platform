import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeAndLaunchDbAdminDiagnostic,
  extractValidatedRunIdFromEvent,
  mapDiagnosticLauncherFailureCode,
} from "../s2g-db-admin-launcher/broker/diagnostic-launcher-core.mjs";

const AUTH_SCHEMA_VERSION = "2026-10-13";
const AUTH_PURPOSE = "STAGING_DB_ADMIN_READONLY_DIAGNOSTIC";
const APPROVED_TASK_ARN = "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:1";
const APPROVED_CLUSTER_ARN = "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production";
const APPROVED_IMAGE_DIGEST = "sha256:4603f32f34be3dcf4c4c80fee1c521d2427fc95b54d6e031fb0fa868143be7b5";
const APPROVED_NETWORK_IDENTITY = "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production|subnet-1,subnet-2|sg-1";
const APPROVED_SECRET_ARN = "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP";

function baseConfig() {
  return {
    launcherActivationState: "ENABLED",
    expectedAccountId: "452630323448",
    expectedRegion: "us-west-2",
    stagingClusterArn: APPROVED_CLUSTER_ARN,
    approvedDiagnosticTaskDefinitionArn: APPROVED_TASK_ARN,
    approvedDiagnosticImageDigest: APPROVED_IMAGE_DIGEST,
    taskContainerName: "S2gDbAdminDiagnostic",
    subnets: ["subnet-1", "subnet-2"],
    securityGroups: ["sg-1"],
    approvedNetworkIdentity: APPROVED_NETWORK_IDENTITY,
    expectedDatabaseHost: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com",
    expectedDatabaseName: "genesis_staging",
    approvedAdminSecretArn: APPROVED_SECRET_ARN,
    claimTtlSeconds: 180,
  };
}

function baseAuthorization(runId = "s2g-dbdiag-abc123") {
  return {
    runId,
    launchState: "AUTHORIZED",
    purpose: AUTH_PURPOSE,
    schemaVersion: AUTH_SCHEMA_VERSION,
    approvedDiagnosticTaskDefinitionArn: APPROVED_TASK_ARN,
    approvedClusterArn: APPROVED_CLUSTER_ARN,
    approvedDiagnosticImageDigest: APPROVED_IMAGE_DIGEST,
    approvedNetworkIdentity: APPROVED_NETWORK_IDENTITY,
    authorizedOperatorArn: "arn:aws:sts::452630323448:assumed-role/DiagOperator/rober",
    authorizationCreatorArn: "arn:aws:sts::452630323448:assumed-role/DiagAuthCreator/admin",
    expectedAccountId: "452630323448",
    expectedRegion: "us-west-2",
    createdAtEpoch: 1760385400,
    expiresAtEpoch: 1760386500,
    maxLaunchAttempts: 1,
    launchAttempts: 0,
  };
}

function baseEvent(runId = "s2g-dbdiag-abc123") {
  return {
    requestContext: {
      authorizer: {
        iam: {
          userArn: "arn:aws:sts::452630323448:assumed-role/DiagOperator/rober",
        },
      },
    },
    body: JSON.stringify({ runId }),
  };
}

function functionUrlEventFixture(runId = "s2g-dbdiag-abc123") {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/",
    requestContext: {
      requestId: "fixture-request-id",
      authorizer: {
        iam: {
          userArn: "arn:aws:sts::452630323448:assumed-role/DiagOperator/rober",
        },
      },
    },
    body: JSON.stringify({ runId }),
  };
}

function baseDeps(overrides = {}) {
  const calls = { runTask: [] };
  return {
    calls,
    nowIso: () => "2026-10-13T20:00:00.000Z",
    nowEpochSeconds: () => 1760385600,
    async getLaunchRecord(runId) {
      return baseAuthorization(runId);
    },
    async claimLaunch() {
      return { status: "CLAIMED" };
    },
    async describeTaskDefinition(taskDefinitionArn) {
      return {
        taskDefinition: {
          taskDefinitionArn,
          containerDefinitions: [{
            name: "S2gDbAdminDiagnostic",
            image: `452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-staging-s2g-db-admin-diagnostic@${APPROVED_IMAGE_DIGEST}`,
            command: ["node", "scripts/staging-s2g-db-admin-diagnostic.mjs"],
            environment: [
              { name: "GENESIS_ENVIRONMENT", value: "staging" },
              { name: "DB_HOST", value: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com" },
              { name: "DB_NAME", value: "genesis_staging" },
            ],
            secrets: [
              { name: "DB_ADMIN_USERNAME", valueFrom: `${APPROVED_SECRET_ARN}:username::` },
              { name: "DB_ADMIN_PASSWORD", valueFrom: `${APPROVED_SECRET_ARN}:password::` },
            ],
          }],
        },
      };
    },
    async runTask(input) {
      calls.runTask.push(input);
      return { tasks: [{ taskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/abc" }] };
    },
    async recordLaunch() {},
    async recordLaunchFailure() {},
    async recordLaunchOutcomeUnknown() {},
    ...overrides,
  };
}

test("launches diagnostic task with fixed command/network and execute-command disabled", async () => {
  const deps = baseDeps();
  const response = await authorizeAndLaunchDbAdminDiagnostic(baseEvent(), { config: baseConfig(), deps });
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.outcome, "LAUNCHED");
  assert.equal(deps.calls.runTask.length, 1);
  const runInput = deps.calls.runTask[0];
  assert.equal(runInput.enableExecuteCommand, false);
  assert.equal(runInput.clientToken, "s2g-dbdiag-abc123");
  assert.equal(runInput.networkConfiguration.awsvpcConfiguration.assignPublicIp, "DISABLED");
  assert.deepEqual(runInput.overrides.containerOverrides[0].command, [
    "node",
    "scripts/staging-s2g-db-admin-diagnostic.mjs",
  ]);
});

test("rejects disabled launcher, unauthenticated callers, and cross-account callers", async () => {
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: { ...baseConfig(), launcherActivationState: "DISABLED" },
      deps: baseDeps(),
    }),
    /DIAG_LAUNCHER_DISABLED/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(
      { body: JSON.stringify({ runId: "s2g-dbdiag-abc123" }) },
      { config: baseConfig(), deps: baseDeps() },
    ),
    /DIAG_LAUNCHER_UNAUTHENTICATED/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(
      {
        ...baseEvent(),
        requestContext: { authorizer: { iam: { userArn: "arn:aws:sts::111111111111:assumed-role/Other/user" } } },
      },
      { config: baseConfig(), deps: baseDeps() },
    ),
    /DIAG_LAUNCHER_CROSS_ACCOUNT_DENIED/,
  );
});

test("extracts runId only when request payload is strictly valid", () => {
  assert.equal(extractValidatedRunIdFromEvent(functionUrlEventFixture()), "s2g-dbdiag-abc123");
  assert.equal(extractValidatedRunIdFromEvent({ body: JSON.stringify({ runId: "BAD" }) }), null);
  assert.equal(extractValidatedRunIdFromEvent({ body: JSON.stringify({ runId: "s2g-dbdiag-abc123", sql: "SELECT 1" }) }), null);
  assert.equal(extractValidatedRunIdFromEvent({ body: "{" }), null);
});

test("uses Function URL IAM request-context ARN for pre-claim operator guard", async () => {
  let claimCalled = false;
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(functionUrlEventFixture(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return { ...baseAuthorization(runId), authorizedOperatorArn: "arn:aws:sts::452630323448:assumed-role/DiagOperator/not-rober" };
        },
        async claimLaunch() {
          claimCalled = true;
          return { status: "CLAIMED" };
        },
      }),
    }),
    /DIAG_LAUNCHER_OPERATOR_NOT_AUTHORIZED/,
  );
  assert.equal(claimCalled, false);
});

test("fails closed on pre-launch authorization contract mismatch before RunTask", async () => {
  let runTaskCalled = false;
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async claimLaunch() {
          return { status: "AUTHORIZATION_CONTRACT_MISMATCH" };
        },
        async runTask() {
          runTaskCalled = true;
          return { tasks: [] };
        },
      }),
    }),
    /DIAG_LAUNCHER_RUN_CONTRACT_MISMATCH/,
  );
  assert.equal(runTaskCalled, false);
});

test("rejects missing, expired, wrong-purpose, wrong-operator, wrong-task, wrong-image, wrong-network, and wrong-cluster authorizations", async () => {
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({ async getLaunchRecord() { return null; } }),
    }),
    /DIAG_LAUNCHER_RUN_NOT_AUTHORIZED/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return { ...baseAuthorization(runId), expiresAtEpoch: 1760385500 };
        },
      }),
    }),
    /DIAG_LAUNCHER_RUN_AUTHORIZATION_EXPIRED/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return { ...baseAuthorization(runId), purpose: "OTHER_PURPOSE" };
        },
      }),
    }),
    /DIAG_LAUNCHER_RUN_PURPOSE_MISMATCH/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return { ...baseAuthorization(runId), authorizedOperatorArn: "arn:aws:sts::452630323448:assumed-role/DiagOperator/other" };
        },
      }),
    }),
    /DIAG_LAUNCHER_OPERATOR_NOT_AUTHORIZED/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return { ...baseAuthorization(runId), approvedDiagnosticTaskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:9" };
        },
      }),
    }),
    /DIAG_LAUNCHER_TASK_DEFINITION_MISMATCH/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return { ...baseAuthorization(runId), approvedDiagnosticImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
        },
      }),
    }),
    /DIAG_LAUNCHER_TASK_IMAGE_DIGEST_MISMATCH/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return { ...baseAuthorization(runId), approvedNetworkIdentity: "bad-network-identity" };
        },
      }),
    }),
    /DIAG_LAUNCHER_NETWORK_IDENTITY_MISMATCH/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return { ...baseAuthorization(runId), approvedClusterArn: "arn:aws:ecs:us-west-2:452630323448:cluster/other" };
        },
      }),
    }),
    /DIAG_LAUNCHER_CLUSTER_MISMATCH/,
  );
});

test("rejects caller-provided overrides, arbitrary SQL, and alternate command payloads", async () => {
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic({
      ...baseEvent(),
      body: JSON.stringify({
        runId: "s2g-dbdiag-abc123",
        overrides: { command: ["evil"] },
        sql: "SELECT 1",
        command: ["--prepare-provisioning-sql"],
      }),
    }, {
      config: baseConfig(),
      deps: baseDeps(),
    }),
    /DIAG_LAUNCHER_OVERRIDES_REJECTED/,
  );
});

test("fails closed on consumed, claimed, failed, unknown, and legacy records", async () => {
  for (const launchState of ["CLAIMED", "LAUNCH_FAILED", "OUTCOME_UNKNOWN"]) {
    await assert.rejects(
      authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
        config: baseConfig(),
        deps: baseDeps({
          async getLaunchRecord(runId) {
            return { ...baseAuthorization(runId), launchState };
          },
        }),
      }),
      /DIAG_LAUNCHER_RUN_ALREADY_CONSUMED/,
    );
  }
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async getLaunchRecord(runId) {
          return {
            runId,
            launchState: "CLAIMED",
            purpose: AUTH_PURPOSE,
            claimInvokerArn: "arn:aws:sts::452630323448:assumed-role/DiagOperator/rober",
          };
        },
      }),
    }),
    /DIAG_LAUNCHER_RUN_SCHEMA_UNSUPPORTED/,
  );
});

test("treats replayed launched run as idempotent success", async () => {
  const response = await authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
    config: baseConfig(),
    deps: baseDeps({
      async getLaunchRecord(runId) {
        return {
          ...baseAuthorization(runId),
          launchState: "LAUNCHED",
          launchTaskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/already",
        };
      },
    }),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).outcome, "IDEMPOTENT_ALREADY_LAUNCHED");
});

test("duplicate and concurrent claim attempts fail closed without re-launch", async () => {
  const inProgressDeps = baseDeps({
    async claimLaunch() {
      return { status: "CLAIM_IN_PROGRESS" };
    },
    async runTask() {
      assert.fail("runTask must not execute while claim is in progress");
    },
  });
  const inProgress = await authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
    config: baseConfig(),
    deps: inProgressDeps,
  });
  assert.equal(inProgress.statusCode, 409);
  assert.equal(JSON.parse(inProgress.body).outcome, "AUTHORIZATION_CONSUMED_OR_IN_PROGRESS");

  const consumedDeps = baseDeps({
    async claimLaunch() {
      return { status: "ALREADY_CONSUMED" };
    },
    async runTask() {
      assert.fail("runTask must not execute for consumed authorization");
    },
  });
  const consumed = await authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
    config: baseConfig(),
    deps: consumedDeps,
  });
  assert.equal(consumed.statusCode, 409);
});

test("records failed and ambiguous runTask outcomes as consumed non-reusable states", async () => {
  let failureRecorded = 0;
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async runTask() {
          return { failures: [{ reason: "RESOURCE:CPU" }] };
        },
        async recordLaunchFailure() {
          failureRecorded += 1;
        },
      }),
    }),
    /DIAG_LAUNCHER_ECS_RUN_TASK_FAILED/,
  );
  assert.equal(failureRecorded, 1);

  let unknownRecorded = 0;
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async runTask() {
          throw Object.assign(new Error("timeout"), { code: "TimeoutError" });
        },
        async recordLaunchOutcomeUnknown() {
          unknownRecorded += 1;
        },
      }),
    }),
    /DIAG_LAUNCHER_ECS_RUN_TASK_OUTCOME_UNKNOWN/,
  );
  assert.equal(unknownRecorded, 1);
});

test("rejects non-digest image, wrong task command, wrong revision, and production DB targets", async () => {
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async describeTaskDefinition() {
          return {
            taskDefinition: {
              taskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:5",
              containerDefinitions: [],
            },
          };
        },
      }),
    }),
    /DIAG_LAUNCHER_TASK_DEFINITION_MISMATCH/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async describeTaskDefinition(taskDefinitionArn) {
          return {
            taskDefinition: {
              taskDefinitionArn,
              containerDefinitions: [{
                name: "S2gDbAdminDiagnostic",
                image: "repo/image:latest",
                command: [],
              }],
            },
          };
        },
      }),
    }),
    /DIAG_LAUNCHER_TASK_IMAGE_NOT_IMMUTABLE/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: baseConfig(),
      deps: baseDeps({
        async describeTaskDefinition(taskDefinitionArn) {
          const response = await baseDeps().describeTaskDefinition(taskDefinitionArn);
          response.taskDefinition.containerDefinitions[0].command = ["node", "evil.js"];
          return response;
        },
      }),
    }),
    /DIAG_LAUNCHER_TASK_COMMAND_MISMATCH/,
  );
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: {
        ...baseConfig(),
        expectedDatabaseHost: "genesis-production-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com",
      },
      deps: baseDeps(),
    }),
    /DIAG_LAUNCHER_PRODUCTION_RESOURCE_REJECTED/,
  );
});

test("maps unknown failures to sanitized fixed code", () => {
  assert.equal(mapDiagnosticLauncherFailureCode(new Error("unexpected")), "DIAG_LAUNCHER_FAILED");
});
