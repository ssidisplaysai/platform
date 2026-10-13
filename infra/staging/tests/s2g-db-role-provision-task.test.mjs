import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateS2gDbRoleProvisionExecutionPolicy } from "../iam/validate-s2g-db-role-provision-execution-policy.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse((await readFile(resolve(repoRoot, path), "utf8")).replace(/^\uFEFF/, ""));
}

test("s2g db role provision task is dedicated, private, and diagnostic-only by default", async () => {
  const task = await readJson("infra/staging/s2g-db-role-provision-task-definition.template.json");
  assert.equal(task.family, "genesis-staging-s2g-db-role-provision");
  assert.equal(task.taskRoleArn, "arn:aws:iam::452630323448:role/genesis-staging-s2g-db-role-provision-task-role");
  assert.equal(task.executionRoleArn, "arn:aws:iam::452630323448:role/genesis-staging-s2g-db-role-provision-execution-role");
  assert.deepEqual(task.requiresCompatibilities, ["FARGATE"]);
  assert.equal(task.networkMode, "awsvpc");
  const [container] = task.containerDefinitions;
  assert.equal(container.name, "S2gDbRoleProvisioner");
  assert.equal(container.readonlyRootFilesystem, true);
  assert.equal(container.user, "1000:1000");
  assert.equal(container.portMappings, undefined);
  assert.deepEqual(container.command, [
    "node",
    "scripts/staging-s2g-db-role-provision.mjs",
    "--diagnose-admin-readonly",
  ]);
  assert.ok(!container.command.some((part) => /--prepare-provisioning-sql|--sql|--execute/i.test(part)));
  assert.deepEqual(container.environment.map(({ name }) => name).sort(), [
    "DB_HOST",
    "DB_NAME",
    "DB_PORT",
    "GENESIS_ENVIRONMENT",
    "GENESIS_RDS_CA_CERT",
  ]);
  assert.deepEqual(container.secrets.map(({ name }) => name).sort(), ["DB_ADMIN_PASSWORD", "DB_ADMIN_USERNAME"]);
  assert.ok(container.secrets.every(({ valueFrom }) =>
    valueFrom.startsWith("arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP:")));
  assert.equal(container.logConfiguration.options["awslogs-group"], "/genesis/staging/s2g-db-role-provision");
  assert.equal(container.logConfiguration.options["awslogs-stream-prefix"], "diagnostic");
});

test("s2g db role provision execution policy is pinned to exact staging admin secret", async () => {
  const policy = await readJson("infra/staging/iam/s2g-db-role-provision-execution-secrets.json");
  validateS2gDbRoleProvisionExecutionPolicy(policy);
  assert.equal(policy.Statement.length, 1);
  assert.deepEqual(policy.Statement[0].Action, ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]);
});

test("permissions plan documents override-immutability controls and staging-only boundaries", async () => {
  const plan = await readJson("infra/staging/s2g-db-role-provision-permissions.plan.json");
  assert.equal(plan.status, "draft-not-applied");
  assert.equal(plan.taskDefinitionFamily, "genesis-staging-s2g-db-role-provision");
  assert.equal(plan.assignPublicIp, "DISABLED");
  assert.equal(plan.adminSecretArn, "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP");
  assert.equal(plan.launchControls.directEcsRunTask, "unsafe-due-to-overrides");
  assert.equal(plan.launchControls.requiredControlPlane, "dedicated fixed-configuration launcher");
  assert.ok(plan.launchControls.recommendedLauncher.behavior.some((line) => line.includes("Ignore caller taskDefinition/network/command overrides")));
  assert.equal(plan.modes.diagnosticOnly.writesData, false);
  assert.equal(plan.modes.provisioningPlannedNotExecuted.script, "DISABLED_IN_THIS_REVISION");
  assert.ok(plan.provisioningBoundary.forbidden.includes("arbitrary SQL from operators"));
  assert.ok(plan.newPermissions.every((entry) => !JSON.stringify(entry).includes("\"Resource\":\"*\"")));
});
