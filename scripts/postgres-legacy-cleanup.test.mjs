import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  BUSINESS_NAMESPACE,
  LEGACY_CERTIFICATION_NAMESPACES,
  cleanupLegacyCertificationRows,
} from "./postgres-legacy-cleanup.mjs";

function fakePool({ namespaces, revision = "24", deleteCount = 2 }) {
  const state = { rows: [...namespaces], calls: [], committed: false };
  const client = {
    async query(sql, params) {
      state.calls.push({ sql: sql.trim().split("\n")[0], params });
      if (sql === "COMMIT") state.committed = true;
      if (sql.startsWith("SELECT namespace FROM")) return { rows: state.rows.map((namespace) => ({ namespace })) };
      if (sql.includes("canonical_text")) {
        return { rows: [{ namespace: BUSINESS_NAMESPACE, schema_version: 1, revision, updated_at: "2026-01-01T00:00:00Z", data_is_object: true, canonical_text: '{"a": 1}' }] };
      }
      if (sql.trim().startsWith("DELETE")) {
        state.rows = state.rows.filter((namespace) => !params.includes(namespace));
        return { rowCount: deleteCount };
      }
      return { rows: [] };
    },
    release() {},
  };
  return { pool: { connect: async () => client }, state };
}

const all = [BUSINESS_NAMESPACE, ...LEGACY_CERTIFICATION_NAMESPACES];

test("cleanup deletes only the two exact legacy ids and verifies the business snapshot", async () => {
  const { pool, state } = fakePool({ namespaces: all });
  const result = await cleanupLegacyCertificationRows(pool);
  assert.equal(result.deleted, 2);
  assert.deepEqual(result.namespaces, [BUSINESS_NAMESPACE]);
  assert.deepEqual(result.before, result.after);
  assert.equal(result.before.sha256.length, 64);
  assert.ok(state.committed);
  const del = state.calls.find(({ sql }) => sql.startsWith("DELETE"));
  assert.deepEqual(del.params, [...LEGACY_CERTIFICATION_NAMESPACES]);
  assert.equal(state.calls[0].sql, "BEGIN");
});

for (const [name, options] of [
  ["unexpected extra namespace", { namespaces: [...all, "other"] }],
  ["missing legacy row", { namespaces: [BUSINESS_NAMESPACE, LEGACY_CERTIFICATION_NAMESPACES[0]] }],
  ["missing business row", { namespaces: [...LEGACY_CERTIFICATION_NAMESPACES] }],
  ["wrong business revision", { namespaces: all, revision: "25" }],
  ["delete count mismatch", { namespaces: all, deleteCount: 1 }],
]) {
  test(`cleanup rolls back and never commits on ${name}`, async () => {
    const { pool, state } = fakePool(options);
    await assert.rejects(cleanupLegacyCertificationRows(pool));
    assert.ok(!state.committed);
    assert.ok(state.calls.some(({ sql }) => sql === "ROLLBACK"));
  });
}

test("cleanup uses exact equality and runner mode precedes normal certification work", async () => {
  const cleanup = await readFile(resolve(import.meta.dirname, "postgres-legacy-cleanup.mjs"), "utf8");
  assert.doesNotMatch(cleanup, /\bLIKE\b|~|TRUNCATE|DROP|regexp/i);
  const runner = await readFile(resolve(import.meta.dirname, "staging-postgres-certification.mjs"), "utf8");
  const branch = runner.indexOf('process.argv[2] === "--cleanup-legacy-certification-rows"');
  assert.notEqual(branch, -1);
  assert.ok(branch < runner.indexOf("await provisionApplicationRole(config)"));
  assert.ok(branch < runner.indexOf("runLiveAdapterTests();"));
  const mode = runner.slice(branch, runner.indexOf("--diagnose-schema", branch));
  assert.doesNotMatch(mode, /provisionApplicationRole|migrate-foundation-state|import-foundation-state|runLiveAdapterTest/);
});
