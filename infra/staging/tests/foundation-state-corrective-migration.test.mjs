import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { MigrationBuilder } from "node-pg-migrate";

const require = createRequire(import.meta.url);
const migration = require("../../../migrations/20261010204600_add_foundation_state_constraints.js");
const migrationDirectory = resolve(import.meta.dirname, "../../../migrations");

function createBuilder(queryResults) {
  const queries = [];
  const builder = new MigrationBuilder({
    async query(sql, parameters) {
      queries.push({ sql, parameters });
      const result = queryResults.shift();
      if (!result) throw new Error("Unexpected migration database query.");
      return result;
    },
  }, undefined, false, {});
  return { builder, queries };
}

test("corrective migration generates exactly the two supported named CHECK constraints", async () => {
  const { builder, queries } = createBuilder([
    { rows: [{ negative_revisions: "0", non_object_data: "0" }] },
    { rows: [] },
  ]);

  await migration.up(builder);

  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /revision < 0/);
  assert.match(queries[0].sql, /jsonb_typeof\(data\) IS DISTINCT FROM 'object'/);
  assert.match(queries[1].sql, /pg_constraint/);
  assert.match(
    builder.getSqlSteps()[0],
    /ALTER TABLE "public"\."genesis_foundation_state"\s+ADD CONSTRAINT "genesis_foundation_state_data_object" CHECK \(jsonb_typeof\(data\) = 'object'\);/,
  );
  assert.match(
    builder.getSqlSteps()[1],
    /ALTER TABLE "public"\."genesis_foundation_state"\s+ADD CONSTRAINT "genesis_foundation_state_revision_nonnegative" CHECK \(revision >= 0\);/,
  );
  assert.equal(builder.getSqlSteps().length, 2);
});

test("corrective migration fails closed on violating rows before generating DDL", async () => {
  const { builder, queries } = createBuilder([
    { rows: [{ negative_revisions: "1", non_object_data: "0" }] },
  ]);

  await assert.rejects(migration.up(builder), /violating rows found/);
  assert.equal(queries.length, 1);
  assert.deepEqual(builder.getSqlSteps(), []);
});

test("corrective migration fails closed when data violates the object constraint", async () => {
  const { builder, queries } = createBuilder([
    { rows: [{ negative_revisions: "0", non_object_data: "2" }] },
  ]);

  await assert.rejects(migration.up(builder), /non-object data=2/);
  assert.equal(queries.length, 1);
  assert.deepEqual(builder.getSqlSteps(), []);
});

test("corrective migration does not duplicate already-correct constraints", async () => {
  const { builder } = createBuilder([
    { rows: [{ negative_revisions: "0", non_object_data: "0" }] },
    {
      rows: [
        { name: "genesis_foundation_state_data_object", definition: "CHECK (jsonb_typeof(data) = 'object'::text)" },
        { name: "genesis_foundation_state_revision_nonnegative", definition: "CHECK (revision >= 0)" },
      ],
    },
  ]);

  await migration.up(builder);
  assert.deepEqual(builder.getSqlSteps(), []);
});

test("corrective migration refuses a conflicting existing constraint", async () => {
  const { builder } = createBuilder([
    { rows: [{ negative_revisions: "0", non_object_data: "0" }] },
    { rows: [{ name: "genesis_foundation_state_data_object", definition: "CHECK (true)" }] },
  ]);

  await assert.rejects(
    migration.up(builder),
    /conflicting foundation-state constraint genesis_foundation_state_data_object/,
  );
  assert.deepEqual(builder.getSqlSteps(), []);
});

test("corrective migration is later than the original and refuses destructive rollback", async () => {
  const files = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".js")).sort();
  assert.deepEqual(files.filter((name) => /foundation_state/.test(name)), [
    "20261009000000_foundation_state.js",
    "20261010204600_add_foundation_state_constraints.js",
  ]);
  assert.throws(migration.down, /restore from a verified backup/);
});
