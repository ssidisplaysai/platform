import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");

test("snapshot export permissions plan remains staging-scoped and non-deploying", async () => {
  const plan = JSON.parse(
    (await readFile(resolve(repoRoot, "infra/staging/snapshot-export-permissions.plan.json"), "utf8")).replace(/^\uFEFF/, ""),
  );
  assert.equal(plan.status, "approved-not-applied");
  assert.equal(plan.provisioningReadiness, "READY_WITH_APPROVAL_GATES");
  assert.equal(plan.scope, "staging-only-share-to-grow-snapshot-export");
  assert.equal(plan.activationModel.parameter, "BrokerActivationState");
  assert.equal(plan.activationModel.default, "DISABLED");
  assert.equal(plan.namespace, "share-to-grow-repository");
  assert.equal(plan.artifactStorage.retentionDays, 2);
  assert.equal(plan.databaseRoleProvisioningRequirements.roleName, "genesis_share_to_grow_snapshot_reader");
  assert.equal(plan.databaseRoleProvisioningRequirements.mustUseDedicatedSecret, "SNAPSHOT_DB_READER_SECRET_ARN");
  assert.ok(Array.isArray(plan.currentBlockers));
  assert.equal(plan.currentBlockers.length, 0);
  assert.equal(plan.launchBrokerControls.authorizationRecord, "SnapshotRunAuthorizationTable");
  assert.match(JSON.stringify(plan.launchBrokerControls), /overrideProtection/);
  assert.match(JSON.stringify(plan.launchBrokerControls), /BROKER_DISABLED/);
  assert.match(JSON.stringify(plan.readerBrokerControls), /READER_BROKER_DISABLED/);
  assert.ok(Array.isArray(plan.newRoles));
  assert.equal(plan.newRoles.length, 5);
  const raw = JSON.stringify(plan);
  assert.doesNotMatch(raw, /genesis-production-artifacts-452630323448-us-west-2/);
  assert.doesNotMatch(raw, /genesis-production-web:119/);
});
