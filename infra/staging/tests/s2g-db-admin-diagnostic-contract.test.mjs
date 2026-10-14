import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  S2G_DB_ADMIN_DIAGNOSTIC_COMMAND,
  S2G_DB_ADMIN_DIAGNOSTIC_CONTAINER,
  S2G_DB_ADMIN_DIAGNOSTIC_FAMILY,
} from "../s2g-db-admin-diagnostic-contract.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse((await readFile(resolve(repoRoot, path), "utf8")).replace(/^\uFEFF/, ""));
}

test("launcher and task definition stay aligned to the same family/container/command contract", async () => {
  const task = await readJson("infra/staging/s2g-db-role-provision-task-definition.template.json");
  const launcherPlan = await readJson("infra/staging/s2g-db-admin-launcher-permissions.plan.json");
  const [container] = task.containerDefinitions;
  assert.equal(task.family, S2G_DB_ADMIN_DIAGNOSTIC_FAMILY);
  assert.equal(container.name, S2G_DB_ADMIN_DIAGNOSTIC_CONTAINER);
  assert.deepEqual(container.command, S2G_DB_ADMIN_DIAGNOSTIC_COMMAND);
  assert.equal(launcherPlan.approvedDiagnosticTaskFamily, S2G_DB_ADMIN_DIAGNOSTIC_FAMILY);
  assert.deepEqual(launcherPlan.fixedCommand, S2G_DB_ADMIN_DIAGNOSTIC_COMMAND);
});

