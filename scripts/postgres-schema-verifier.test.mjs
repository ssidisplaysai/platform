import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  compareFoundationSchema,
  FOUNDATION_MIGRATION_VERIFICATION_QUERY,
  FOUNDATION_SCHEMA_VERIFICATION_QUERY,
  verifyFoundationSchema,
} from "./postgres-schema-verifier.mjs";

const expectedSchema = {
  database: "genesis_staging",
  username: "genesis_app",
  table_exists: true,
  table_owner: "genesis_app",
  columns: [
    { column_name: "namespace", data_type: "text", udt_name: "text", is_nullable: "NO", column_default: null },
    { column_name: "schema_version", data_type: "integer", udt_name: "int4", is_nullable: "NO", column_default: null },
    { column_name: "revision", data_type: "bigint", udt_name: "int8", is_nullable: "NO", column_default: "0" },
    { column_name: "updated_at", data_type: "timestamp with time zone", udt_name: "timestamptz", is_nullable: "NO", column_default: null },
    { column_name: "data", data_type: "jsonb", udt_name: "jsonb", is_nullable: "NO", column_default: null },
  ],
  primary_key: { constraint_name: "genesis_foundation_state_pkey", columns: ["namespace"] },
  indexes: [{ index_name: "genesis_foundation_state_pkey", is_primary: true, is_unique: true }],
  constraints: [
    { constraint_name: "genesis_foundation_state_data_object", constraint_type: "c", definition: "CHECK (jsonb_typeof(data) = 'object'::text)" },
    { constraint_name: "genesis_foundation_state_pkey", constraint_type: "p", definition: "PRIMARY KEY (namespace)" },
    { constraint_name: "genesis_foundation_state_revision_nonnegative", constraint_type: "c", definition: "CHECK (revision >= 0)" },
  ],
};

const migrations = [
  { name: "20261009000000_foundation_state", id: 1, run_on: "2026-10-10T00:00:00.000Z" },
  { name: "20261010204600_add_foundation_state_constraints", id: 2, run_on: "2026-10-11T00:00:00.000Z" },
];

test("verifier accepts exact schema metadata and both ordered migration records", () => {
  const jsonbMetadata = structuredClone(expectedSchema);
  jsonbMetadata.columns = jsonbMetadata.columns.map((column) => Object.fromEntries(Object.entries(column).reverse()));
  jsonbMetadata.indexes = jsonbMetadata.indexes.map((index) => Object.fromEntries(Object.entries(index).reverse()));
  jsonbMetadata.constraints = jsonbMetadata.constraints.map((constraint) =>
    Object.fromEntries(Object.entries(constraint).reverse()));
  assert.deepEqual(compareFoundationSchema(jsonbMetadata, migrations, "genesis_staging", "genesis_app"), []);
});

test("verifier rejects type, nullability, default, primary-key, extra-index, constraint and migration drift", () => {
  const schema = structuredClone(expectedSchema);
  schema.columns[2].data_type = "integer";
  schema.columns[2].is_nullable = "YES";
  schema.columns[2].column_default = "1";
  schema.primary_key.columns = ["schema_version"];
  schema.table_owner = "genesis_admin";
  schema.indexes.push({ index_name: "unexpected_idx", is_primary: false, is_unique: false });
  schema.constraints.pop();
  assert.deepEqual(
    compareFoundationSchema(schema, migrations.slice(0, 1), "genesis_staging", "genesis_app"),
    ["table_owner", "columns", "primary_key", "indexes", "constraints", "migrations"],
  );
});

test("catalog aggregates cast names to text and inspect exact schema semantics", () => {
  assert.match(FOUNDATION_SCHEMA_VERIFICATION_QUERY, /column_name::text/);
  assert.match(FOUNDATION_SCHEMA_VERIFICATION_QUERY, /attname::text/);
  assert.match(FOUNDATION_SCHEMA_VERIFICATION_QUERY, /indexname::text/);
  assert.match(FOUNDATION_SCHEMA_VERIFICATION_QUERY, /conname::text/);
  assert.match(FOUNDATION_SCHEMA_VERIFICATION_QUERY, /data_type/);
  assert.match(FOUNDATION_SCHEMA_VERIFICATION_QUERY, /is_nullable/);
  assert.match(FOUNDATION_SCHEMA_VERIFICATION_QUERY, /column_default/);
  assert.match(FOUNDATION_SCHEMA_VERIFICATION_QUERY, /pg_get_constraintdef/);
  assert.match(FOUNDATION_MIGRATION_VERIFICATION_QUERY, /WHERE name = ANY/);
});

test("runtime runner delegates schema verification to the tested verifier", async () => {
  const runner = await readFile(resolve(import.meta.dirname, "staging-postgres-certification.mjs"), "utf8");
  assert.match(runner, /await verifyFoundationSchema\(pool, expectedDatabase, expectedAppUser\)/);
  assert.doesNotMatch(runner, /array_agg\(column_name ORDER BY ordinal_position\)/);
});

test("verifier executes separate schema and migration queries and rejects missing requirements", async () => {
  const calls = [];
  const client = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      return calls.length === 1 ? { rows: [expectedSchema] } : { rows: migrations };
    },
  };
  assert.deepEqual(
    await verifyFoundationSchema(client, "genesis_staging", "genesis_app"),
    expectedSchema,
  );
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].parameters, [[
    "20261009000000_foundation_state",
    "20261010204600_add_foundation_state_constraints",
  ]]);

  const invalidClient = {
    async query(sql) {
      return sql === FOUNDATION_SCHEMA_VERIFICATION_QUERY
        ? { rows: [expectedSchema] }
        : { rows: migrations.slice(0, 1) };
    },
  };
  await assert.rejects(
    verifyFoundationSchema(invalidClient, "genesis_staging", "genesis_app"),
    /schema verification failed: migrations/,
  );
});
