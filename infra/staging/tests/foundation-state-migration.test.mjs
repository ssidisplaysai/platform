import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const migration = require("../../../migrations/20261009000000_foundation_state.js");

test("foundation-state migration creates the revisioned JSONB table and required constraints", () => {
  const calls = [];
  const pgm = {
    createTable: (...args) => calls.push(args),
  };

  migration.up(pgm);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "genesis_foundation_state");
  assert.deepEqual(calls[0][1], {
    namespace: { type: "text", primaryKey: true, notNull: true },
    schema_version: { type: "integer", notNull: true },
    revision: { type: "bigint", notNull: true, default: 0 },
    updated_at: { type: "timestamptz", notNull: true },
    data: { type: "jsonb", notNull: true },
  });
  assert.deepEqual(calls[0][2].constraints, {
    genesis_foundation_state_revision_nonnegative: "CHECK (revision >= 0)",
    genesis_foundation_state_data_object: "CHECK (jsonb_typeof(data) = 'object')",
  });
});

test("foundation-state migration refuses destructive rollback", () => {
  assert.throws(
    () => migration.down(),
    /restore from a verified backup instead of dropping it/,
  );
});
