import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeAndLaunchSnapshotExport,
  mapLaunchBrokerFailureCode,
} from "../snapshot-export/broker/launch-broker-core.mjs";

function baseConfig() {
  return {
    expectedAccountId: "452630323448",
    stagingClusterArn: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
    approvedTaskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-snapshot-export:7",
    taskContainerName: "StagingSnapshotExport",
    subnets: ["subnet-1", "subnet-2"],
    securityGroups: ["sg-1"],
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
    async getRunAuthorization(runId) {
      return {
        runId,
        status: "APPROVED",
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
  assert.equal(runInput.networkConfiguration.awsvpcConfiguration.assignPublicIp, "DISABLED");
  assert.deepEqual(runInput.overrides.containerOverrides[0].command, [
    "node",
    "scripts/share-to-grow-snapshot-export.mjs",
    "--run-id",
    "s2g-run-abc123",
  ]);
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
        status: "ALREADY_CLAIMED",
        launchTaskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/already",
      };
    },
  });
  const response = await authorizeAndLaunchSnapshotExport(baseEvent(), { config: baseConfig(), deps });
  const payload = JSON.parse(response.body);
  assert.equal(payload.outcome, "IDEMPOTENT_ALREADY_LAUNCHED");
  assert.equal(payload.launchTaskArn, "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/already");
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

