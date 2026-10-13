import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse((await readFile(resolve(repoRoot, path), "utf8")).replace(/^\uFEFF/, ""));
}

test("diagnostic launcher plan enforces disabled bootstrap and fixed launch boundaries", async () => {
  const plan = await readJson("infra/staging/s2g-db-admin-launcher-permissions.plan.json");
  assert.equal(plan.status, "draft-not-applied");
  assert.equal(plan.activationModel.default, "DISABLED");
  assert.deepEqual(plan.activationModel.allowedValues, ["DISABLED", "ENABLED"]);
  assert.equal(plan.approvedDiagnosticTaskFamily, "genesis-staging-s2g-db-role-provision");
  assert.equal(plan.network.assignPublicIp, "DISABLED");
  assert.equal(plan.network.enableExecuteCommand, false);
  assert.deepEqual(plan.fixedCommand, [
    "node",
    "scripts/staging-s2g-db-role-provision.mjs",
    "--diagnose-admin-readonly",
  ]);
  assert.ok(plan.operatorRestrictions.includes("No direct ecs:RunTask permission"));
  assert.ok(plan.operatorRestrictions.includes("No direct iam:PassRole permission"));
  assert.deepEqual(plan.secretBoundary.allowedActions, ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]);
});
