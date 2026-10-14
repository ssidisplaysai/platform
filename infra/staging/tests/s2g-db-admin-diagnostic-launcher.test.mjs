import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeAndLaunchDbAdminDiagnostic,
  mapDiagnosticLauncherFailureCode,
} from "../s2g-db-admin-launcher/broker/diagnostic-launcher-core.mjs";

function baseConfig() {
  return {
    launcherActivationState: "ENABLED",
    expectedAccountId: "452630323448",
    expectedRegion: "us-west-2",
    stagingClusterArn: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
    approvedDiagnosticTaskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:4",
    taskContainerName: "S2gDbAdminDiagnostic",
    subnets: ["subnet-1", "subnet-2"],
    securityGroups: ["sg-1"],
    expectedDatabaseHost: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com",
    expectedDatabaseName: "genesis_staging",
    approvedAdminSecretArn: "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP",
    claimTtlSeconds: 180,
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

function baseDeps(overrides = {}) {
  const calls = { runTask: [] };
  return {
    calls,
    nowIso: () => "2026-10-13T20:00:00.000Z",
    nowEpochSeconds: () => 1760385600,
    async getLaunchRecord() {
      return null;
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
            image: "repo/image@sha256:1234",
            command: ["node", "scripts/staging-s2g-db-admin-diagnostic.mjs"],
            environment: [
              { name: "GENESIS_ENVIRONMENT", value: "staging" },
              { name: "DB_HOST", value: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com" },
              { name: "DB_NAME", value: "genesis_staging" },
            ],
            secrets: [
              { name: "DB_ADMIN_USERNAME", valueFrom: "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP:username::" },
              { name: "DB_ADMIN_PASSWORD", valueFrom: "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP:password::" },
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

test("rejects disabled launcher and unauthorized principals", async () => {
  await assert.rejects(
    authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
      config: { ...baseConfig(), launcherActivationState: "DISABLED" },
      deps: baseDeps(),
    }),
    /DIAG_LAUNCHER_DISABLED/,
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
              containerDefinitions: [{ name: "S2gDbAdminDiagnostic", image: "repo/image:latest", command: [] }],
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
      config: { ...baseConfig(), approvedDiagnosticTaskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:4", expectedDatabaseHost: "genesis-production-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com" },
      deps: baseDeps(),
    }),
    /DIAG_LAUNCHER_PRODUCTION_RESOURCE_REJECTED/,
  );
});

test("concurrent and replay requests remain idempotent and safe", async () => {
  const inProgress = await authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
    config: baseConfig(),
    deps: baseDeps({
      async claimLaunch() {
        return { status: "CLAIM_IN_PROGRESS" };
      },
      async runTask() {
        assert.fail("runTask must not execute while claim is in progress");
      },
    }),
  });
  assert.equal(inProgress.statusCode, 202);
  assert.equal(JSON.parse(inProgress.body).outcome, "CLAIM_IN_PROGRESS");

  const replay = await authorizeAndLaunchDbAdminDiagnostic(baseEvent(), {
    config: baseConfig(),
    deps: baseDeps({
      async getLaunchRecord() {
        return {
          launchState: "LAUNCHED",
          launchTaskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/already",
        };
      },
      async runTask() {
        assert.fail("runTask must not execute for already launched runId");
      },
    }),
  });
  assert.equal(replay.statusCode, 200);
  assert.equal(JSON.parse(replay.body).outcome, "IDEMPOTENT_ALREADY_LAUNCHED");
});

test("maps unknown failures to sanitized fixed code", () => {
  assert.equal(mapDiagnosticLauncherFailureCode(new Error("unexpected")), "DIAG_LAUNCHER_FAILED");
});
