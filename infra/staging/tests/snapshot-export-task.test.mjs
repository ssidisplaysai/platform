import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse((await readFile(resolve(repoRoot, path), "utf8")).replace(/^\uFEFF/, ""));
}

test("snapshot export task is staging-only, one-off, and read-only against sources", async () => {
  const task = await readJson("infra/staging/snapshot-export-task-definition.template.json");
  assert.equal(task.family, "genesis-staging-snapshot-export");
  assert.equal(task.taskRoleArn, "${SNAPSHOT_EXPORTER_TASK_ROLE_ARN}");
  assert.equal(task.executionRoleArn, "arn:aws:iam::452630323448:role/genesis-staging-execution-role");
  assert.deepEqual(task.requiresCompatibilities, ["FARGATE"]);
  assert.equal(task.networkMode, "awsvpc");
  const [container] = task.containerDefinitions;
  assert.equal(container.name, "StagingSnapshotExport");
  assert.equal(container.readonlyRootFilesystem, true);
  assert.equal(container.user, "1000:1000");
  assert.equal(container.portMappings, undefined);
  assert.ok(container.command.includes("scripts/share-to-grow-snapshot-export.mjs"));
  assert.equal(container.command.filter((part) => part === "--run-id").length, 1);
  assert.equal(container.command.filter((part) => part.startsWith("--")).length, 1);
  assert.ok(container.environment.some(({ name, value }) => name === "GENESIS_ENVIRONMENT" && value === "staging"));
  assert.ok(container.environment.some(({ name, value }) => name === "S2G_EFS_SOURCE_PATH" && value.includes("share-to-grow-repository.json")));
  assert.ok(container.environment.some(({ name, value }) => name === "S2G_SNAPSHOT_EXPECTED_DB_USERNAME" && value === "genesis_share_to_grow_snapshot_reader"));
  assert.ok(!container.environment.some(({ value }) => /genesis-production-web|genesis-share-to-grow-production/i.test(value)));
  assert.deepEqual(container.secrets.map(({ name }) => name).sort(), ["DB_PASSWORD", "DB_USERNAME"]);
  assert.ok(container.secrets.every(({ valueFrom }) => valueFrom.startsWith("${SNAPSHOT_DB_READER_SECRET_ARN}")));
  assert.deepEqual(container.mountPoints, [{
    sourceVolume: "genesis-persistence",
    containerPath: "/mnt/genesis-persistence",
    readOnly: true,
  }]);
  assert.equal(task.volumes[0].efsVolumeConfiguration.authorizationConfig.iam, "DISABLED");
});
