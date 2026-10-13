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
  assert.equal(plan.scope, "staging-only-share-to-grow-snapshot-export");
  assert.equal(plan.namespace, "share-to-grow-repository");
  assert.equal(plan.artifactStorage.retentionDays, 2);
  assert.ok(Array.isArray(plan.newRoles));
  assert.equal(plan.newRoles.length, 3);
  const raw = JSON.stringify(plan);
  assert.doesNotMatch(raw, /genesis-production-artifacts-452630323448-us-west-2/);
  assert.doesNotMatch(raw, /genesis-production-web:119/);
});

