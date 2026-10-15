import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeAndLaunchSnapshotExport,
  mapLaunchBrokerFailureCode,
} from "../snapshot-export/broker/launch-broker-core.mjs";

function baseConfig() {
  return {
    brokerActivationState: "ENABLED",
    expectedAccountId: "452630323448",
    stagingClusterArn: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
    approvedTaskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-snapshot-export:7",
    taskContainerName: "StagingSnapshotExport",
    subnets: ["subnet-1", "subnet-2"],
    securityGroups: ["sg-1"],
    claimTtlSeconds: 180,
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
  const calls = { runTask: [] };
  return {
    calls,
    nowIso: () => "2026-10-13T20:00:00.000Z",
    nowEpochSeconds: () => 1760385600,
    async getRunAuthorization(runId) {
      return {
        runId,
        status: "APPROVED",
        expiresAtEpoch: 1760386500,
        operatorArn: "arn:aws:sts::452630323448:assumed-role/SnapshotOperator/rober",
        approvedTaskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-snapshot-export:7",
      };
    },
    async claimRunLaunch() {
      return { status: "CLAIMED" };
    },
    async describeTaskDefinition() {
      return {
        taskDefinition: {
          containerDefinitions: [{
            name: "StagingSnapshotExport",
            image: "repo/image@sha256:1234",
          }],
        },
      };
    },
    async runTask(input) {
      calls.runTask.push(input);
      return { tasks: [{ taskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/abc" }] };
    },
    async recordRunLaunch() {},
    ...overrides,
  };
}

test("launches task with fixed network and command overrides only from broker", async () => {
  const deps = baseDeps();
  const response = await authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps });
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.outcome, "LAUNCHED");
  assert.equal(deps.calls.runTask.length, 1);
  const runInput = deps.calls.runTask[0];
  assert.equal(runInput.enableExecuteCommand, false);
  assert.equal(runInput.clientToken, "s2g-run-abc123");
  assert.equal(runInput.networkConfiguration.awsvpcConfiguration.assignPublicIp, "DISABLED");
  assert.deepEqual(runInput.overrides.containerOverrides[0].command, [
    "node",
    "scripts/share-to-grow-snapshot-export.mjs",
    "--run-id",
    "s2g-run-abc123",
  ]);
});

test("rejects all requests when broker activation is disabled", async () => {
  const deps = baseDeps({
    async getRunAuthorization() {
      assert.fail("authorization lookup must not run when broker is disabled");
    },
    async claimRunLaunch() {
      assert.fail("claim must not run when broker is disabled");
    },
    async describeTaskDefinition() {
      assert.fail("task definition describe must not run when broker is disabled");
    },
    async runTask() {
      assert.fail("runTask must not run when broker is disabled");
    },
  });

  test("fails closed for invalid activation state configuration", async () => {
    await assert.rejects(
      authorizeAndLaunchSnapshotExport(baseEvent(), {
        config: { ...baseConfig(), brokerActivationState: "MAYBE" },
        deps: baseDeps(),
      }),
      /BROKER_CONFIG_INVALID/,
    );
  });
  await assert.rejects(
    authorizeAndLaunchSnapshotExport(baseEvent(), {
      config: { ...baseConfig(), brokerActivationState: "DISABLED" },
      deps,
    }),
    /BROKER_DISABLED/,
  );
});

test("rejects caller-controlled overrides and alternate ECS targets", async () => {
  const deps = baseDeps();
  await assert.rejects(
    authorizeAndLaunchSnapshotExport(
      {
        ...baseEvent(),
        body: JSON.stringify({
          runId: "s2g-run-abc123",
          overrides: { command: ["evil"] },
          clusterArn: "arn:aws:ecs:us-west-2:452630323448:cluster/other",
        }),
      },
      { config: baseConfig(), deps },
    ),
    /BROKER_OVERRIDES_REJECTED/,
  );
});

test("rejects unauthorized operator or run authorization mismatch", async () => {
  const deps = baseDeps({
    async getRunAuthorization(runId) {
      return {
        runId,
        status: "APPROVED",
        expiresAtEpoch: 1760386500,
        operatorArn: "arn:aws:sts::452630323448:assumed-role/SnapshotOperator/other",
        approvedTaskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-snapshot-export:7",
      };
    },
  });
  await assert.rejects(
    authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps }),
    /BROKER_OPERATOR_NOT_AUTHORIZED/,
  );
});

test("idempotent replay returns already launched result", async () => {
  const deps = baseDeps({
    async claimRunLaunch() {
      return {
        status: "ALREADY_LAUNCHED",
        launchTaskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/already",
      };
    },
  });
  const response = await authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps });
  const payload = JSON.parse(response.body);
  assert.equal(payload.outcome, "IDEMPOTENT_ALREADY_LAUNCHED");
  assert.equal(payload.launchTaskArn, "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/already");
});

test("returns claim-in-progress when simultaneous request encounters active claim", async () => {
  const deps = baseDeps({
    async claimRunLaunch() {
      return { status: "CLAIM_IN_PROGRESS" };
    },
    async runTask() {
      assert.fail("runTask must not execute while claim is in progress");
    },
  });
  const response = await authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps });
  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 202);
  assert.equal(payload.outcome, "CLAIM_IN_PROGRESS");
});

test("fails closed when runTask is rejected after claim", async () => {
  const deps = baseDeps({
    async runTask() {
      throw Object.assign(new Error("denied"), { code: "AccessDeniedException" });
    },
  });
  await assert.rejects(
    authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps }),
    (error) => error?.code === "AccessDeniedException",
  );
});

test("retry after ambiguous post-runTask failure is safe with deterministic client token", async () => {
  const calls = [];
  const deps = baseDeps({
    async claimRunLaunch() {
      return { status: "CLAIMED" };
    },
    async runTask(input) {
      calls.push(input.clientToken);
      return { tasks: [{ taskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/retry-safe" }] };
    },
    async recordRunLaunch() {
      throw Object.assign(new Error("ddb timeout"), { code: "TimeoutError" });
    },
  });
  await assert.rejects(
    authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps }),
    (error) => error?.code === "TimeoutError",
  );
  const retryDeps = baseDeps({
    async claimRunLaunch() {
      return { status: "CLAIMED" };
    },
    async runTask(input) {
      calls.push(input.clientToken);
      return { tasks: [{ taskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/retry-safe" }] };
    },
    async recordRunLaunch() {},
  });
  const retryResponse = await authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps: retryDeps });
  const payload = JSON.parse(retryResponse.body);
  assert.equal(retryResponse.statusCode, 200);
  assert.equal(payload.outcome, "LAUNCHED");
  assert.deepEqual(calls, ["s2g-run-abc123", "s2g-run-abc123"]);
});

test("fails closed when task image is not digest-pinned", async () => {
  const deps = baseDeps({
    async describeTaskDefinition() {
      return {
        taskDefinition: {
          containerDefinitions: [{ name: "StagingSnapshotExport", image: "repo/image:latest" }],
        },
      };
    },
  });
  await assert.rejects(
    authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps }),
    /BROKER_TASK_IMAGE_NOT_IMMUTABLE/,
  );
});

test("maps unknown failures to sanitized code", () => {
  assert.equal(mapLaunchBrokerFailureCode(new Error("raw error")), "BROKER_FAILED");
  assert.equal(mapLaunchBrokerFailureCode({ code: "BROKER_RUN_ID_INVALID" }), "BROKER_RUN_ID_INVALID");
});

test("rejects expired run authorization", async () => {
  const deps = baseDeps({
    async getRunAuthorization(runId) {
      return {
        runId,
        status: "APPROVED",
        expiresAtEpoch: 1760385500,
        operatorArn: "arn:aws:sts::452630323448:assumed-role/SnapshotOperator/rober",
        approvedTaskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-snapshot-export:7",
      };
    },
  });
  await assert.rejects(
    authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps }),
    /BROKER_RUN_AUTHORIZATION_EXPIRED/,
  );
});
