import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  collectPostgresSchemaMetadata,
  comparePostgresSchema,
  diagnosePostgresSchemaReadOnly,
  POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES,
} from "./postgres-schema-diagnostic.mjs";

const validMetadata = {
  database: "genesis_staging",
  tables: [
    { table_schema: "public", table_name: "genesis_foundation_state", exists: true, owner: "genesis_admin" },
    { table_schema: "public", table_name: "genesis_schema_migrations", exists: true, owner: "genesis_admin" },
  ],
  columns: [
    { ordinal_position: 1, column_name: "namespace", data_type: "text", udt_name: "text", is_nullable: "NO", column_default: null },
    { ordinal_position: 2, column_name: "schema_version", data_type: "integer", udt_name: "int4", is_nullable: "NO", column_default: null },
    { ordinal_position: 3, column_name: "revision", data_type: "bigint", udt_name: "int8", is_nullable: "NO", column_default: "0" },
    { ordinal_position: 4, column_name: "updated_at", data_type: "timestamp with time zone", udt_name: "timestamptz", is_nullable: "NO", column_default: null },
    { ordinal_position: 5, column_name: "data", data_type: "jsonb", udt_name: "jsonb", is_nullable: "NO", column_default: null },
  ],
  primary_key: [{ constraint_name: "genesis_foundation_state_pkey", columns: ["namespace"] }],
  indexes: [{
    index_name: "genesis_foundation_state_pkey",
    index_definition: "CREATE UNIQUE INDEX genesis_foundation_state_pkey ON public.genesis_foundation_state USING btree (namespace)",
    is_primary: true,
    is_unique: true,
  }],
  constraints: [
    { constraint_name: "genesis_foundation_state_data_object", constraint_type: "c", definition: "CHECK (jsonb_typeof(data) = 'object'::text)" },
    { constraint_name: "genesis_foundation_state_pkey", constraint_type: "p", definition: "PRIMARY KEY (namespace)" },
    { constraint_name: "genesis_foundation_state_revision_nonnegative", constraint_type: "c", definition: "CHECK (revision >= 0)" },
  ],
  migration_rows: [{ id: 1, name: "20261009000000_foundation_state", run_on: "2026-10-10T19:33:00.000Z" }],
  migration_columns: [
    { ordinal_position: 1, column_name: "id", data_type: "integer", udt_name: "int4", is_nullable: "NO", column_default: "nextval('genesis_schema_migrations_id_seq'::regclass)" },
    { ordinal_position: 2, column_name: "name", data_type: "character varying", udt_name: "varchar", is_nullable: "NO", column_default: null },
    { ordinal_position: 3, column_name: "run_on", data_type: "timestamp without time zone", udt_name: "timestamp", is_nullable: "NO", column_default: null },
  ],
  migration_table_present: true,
  migration_rows_returned: 1,
  migration_rows_truncated: false,
};

test("schema diagnostic compares the expected columns, constraints, index, and migration record", () => {
  assert.deepEqual(comparePostgresSchema(validMetadata), []);
});

test("schema comparison identifies column order, type, nullability, default, index, constraint, and migration differences", () => {
  const actual = structuredClone(validMetadata);
  actual.columns.reverse();
  actual.columns.find(({ column_name }) => column_name === "revision").column_default = "1";
  actual.columns.find(({ column_name }) => column_name === "schema_version").data_type = "smallint";
  actual.columns.find(({ column_name }) => column_name === "data").is_nullable = "YES";
  actual.indexes.push({
    index_name: "unexpected_index",
    index_definition: "CREATE INDEX unexpected_index ON public.genesis_foundation_state (revision)",
    is_primary: false,
    is_unique: false,
  });
  actual.constraints.find(({ constraint_name }) => constraint_name === "genesis_foundation_state_data_object").definition =
    "CHECK (jsonb_typeof(data) = 'array'::text)";
  actual.migration_rows[0].name = "unexpected_migration_name";

  assert.deepEqual(
    comparePostgresSchema(actual).map(({ classification }) => classification),
    [
      "A. COLUMN_ORDER_DIFFERENCE",
      "B. COLUMN_TYPE_DIFFERENCE",
      "C. COLUMN_NULLABILITY_DIFFERENCE",
      "D. DEFAULT_EXPRESSION_DIFFERENCE",
      "H. EXTRA_INDEX",
      "J. CONSTRAINT_DEFINITION_DIFFERENCE",
      "K. MIGRATION_RECORD_DIFFERENCE",
    ],
  );
});

test("schema comparison identifies absent tables, primary-key differences, missing index, and constraints", () => {
  const missingTable = structuredClone(validMetadata);
  missingTable.tables[0].exists = false;
  assert.deepEqual(comparePostgresSchema(missingTable).map(({ classification }) => classification), [
    "M. ACTUAL_MIGRATION_DEFECT",
  ]);

  const missingObjects = structuredClone(validMetadata);
  missingObjects.primary_key[0].columns = ["schema_version"];
  missingObjects.indexes = [];
  missingObjects.constraints = [];
  assert.deepEqual(comparePostgresSchema(missingObjects).map(({ classification }) => classification), [
    "F. PRIMARY_KEY_COLUMN_DIFFERENCE",
    "G. INDEX_NAME_DIFFERENCE",
    "I. CONSTRAINT_NAME_DIFFERENCE",
  ]);
});

test("metadata collector issues only bounded SELECTs for the approved public schema objects", async () => {
  const calls = [];
  const results = [
    { rows: [{ database: validMetadata.database, username: "genesis_admin" }] },
    { rows: validMetadata.tables },
    { rows: validMetadata.columns },
    { rows: validMetadata.primary_key },
    { rows: validMetadata.indexes },
    { rows: validMetadata.constraints },
    { rows: [{ migration_row: validMetadata.migration_rows[0], returned_row_count: 1 }] },
    { rows: validMetadata.migration_columns },
  ];
  const pool = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      return results.shift();
    },
  };

  const metadata = await collectPostgresSchemaMetadata(pool);

  assert.deepEqual(metadata, validMetadata);
  assert.equal(calls.length, 8);
  for (const { sql } of calls) {
    assert.match(sql.trim(), /^SELECT\b/i);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
  }
  assert.ok(calls.every(({ sql }) => !/SELECT\s+.*\bdata\b(?!_type)/is.test(sql)));
  assert.deepEqual(calls[6].parameters, ["20261009000000_foundation_state"]);
  assert.match(calls[6].sql, /to_jsonb\(migration_row\)->>'name'/);
  assert.match(calls[6].sql, /'id'[\s\S]+'name'[\s\S]+'run_on'[\s\S]+'run_order'[\s\S]+'migration_id'/);
  assert.doesNotMatch(calls[6].sql, /to_jsonb\(migration_row\)\s+AS/);
  assert.match(calls[1].sql, /'public' AS table_schema/);
  assert.match(calls[7].sql, /information_schema\.columns/);
});

test("metadata queries are limited to schema catalogs and migration bookkeeping", () => {
  for (const query of Object.values(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES)) {
    assert.match(query.trim(), /^SELECT\b/i);
    assert.match(query, /public|information_schema|pg_|current_database/i);
    assert.doesNotMatch(query, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
  }
  assert.match(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.migration, /public\.genesis_schema_migrations/);
});

test("diagnostic runner mode validates target and returns before normal certification work", async () => {
  const source = await readFile(resolve(import.meta.dirname, "staging-postgres-certification.mjs"), "utf8");
  const diagnosticBranch = source.indexOf('process.argv[2] === "--diagnose-schema"');
  assert.notEqual(diagnosticBranch, -1);
  assert.ok(diagnosticBranch < source.indexOf("const sourcePath = process.env.POSTGRES_CERTIFICATION_SOURCE"));
  assert.ok(diagnosticBranch < source.indexOf("await provisionApplicationRole(config)"));
  assert.ok(diagnosticBranch < source.indexOf('["scripts/migrate-foundation-state.mjs", "up"]'));
  assert.ok(diagnosticBranch < source.indexOf('"POSTGRES_LIVE_ADAPTER_TESTS"'));
  const diagnosticCode = source.slice(diagnosticBranch, source.indexOf("const sourcePath", diagnosticBranch));
  assert.match(diagnosticCode, /DB_USERNAME:\s*diagnosticUsername/);
  assert.match(diagnosticCode, /DB_PASSWORD:\s*diagnosticPassword/);
  assert.match(diagnosticCode, /diagnosticUsername !== expectedAdminUser/);
  assert.match(diagnosticCode, /await diagnoseSchema\(config\);\s*console\.log\("POSTGRES_SCHEMA_DIAGNOSTIC=PASS"\);\s*return;/);
  assert.match(source, /config\.host\.toLowerCase\(\) !== expectedHost/);
  assert.match(source, /config\.database !== expectedDatabase/);
  assert.match(source, /process\.env\.GENESIS_ENVIRONMENT !== "staging"/);
  assert.match(source, /if \(process\.env\.GENESIS_STATE_BACKEND\) fail/);
});

test("diagnostic transaction proves read-only before catalog reads and always rolls back", async () => {
  const calls = [];
  const queryResults = [
    { rows: [{ database: validMetadata.database, username: "genesis_admin" }] },
    { rows: [{ database: validMetadata.database, username: "genesis_admin" }] },
    { rows: validMetadata.tables },
    { rows: validMetadata.columns },
    { rows: validMetadata.primary_key },
    { rows: validMetadata.indexes },
    { rows: validMetadata.constraints },
    { rows: [{ migration_row: validMetadata.migration_rows[0], returned_row_count: 1 }] },
    { rows: validMetadata.migration_columns },
  ];
  const client = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql === "SELECT current_setting('transaction_read_only') AS transaction_read_only") {
        return { rows: [{ transaction_read_only: "on" }] };
      }
      if (sql === "BEGIN READ ONLY" || sql === "ROLLBACK") return { rows: [] };
      return queryResults.shift();
    },
    release() {
      calls.push({ sql: "RELEASE" });
    },
  };
  const markers = [];
  const diagnostic = await diagnosePostgresSchemaReadOnly(
    { async connect() { return client; } },
    (marker) => markers.push(marker),
  );

  assert.deepEqual(markers, ["POSTGRES_DIAGNOSTIC_READ_ONLY=PASS"]);
  assert.deepEqual(diagnostic.mismatches, []);
  assert.deepEqual(diagnostic.verifierProjection, {
    database: "genesis_staging",
    database_matches: true,
    table_exists: true,
    columns: ["namespace", "schema_version", "revision", "updated_at", "data"],
    primary_key: ["namespace"],
    indexes: ["genesis_foundation_state_pkey"],
    constraints: [
      "genesis_foundation_state_data_object",
      "genesis_foundation_state_pkey",
      "genesis_foundation_state_revision_nonnegative",
    ],
  });
  assert.equal(calls[0].sql, "BEGIN READ ONLY");
  assert.equal(calls[1].sql, "SELECT current_setting('transaction_read_only') AS transaction_read_only");
  assert.equal(calls[2].sql, POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.database);
  assert.equal(calls[3].sql, POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.database);
  assert.equal(calls[4].sql, POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.tables);
  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("diagnostic refuses catalog reads if PostgreSQL does not confirm read-only mode", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql === "SELECT current_setting('transaction_read_only') AS transaction_read_only") {
        return { rows: [{ transaction_read_only: "off" }] };
      }
      return { rows: [] };
    },
    release() {
      calls.push("RELEASE");
    },
  };

  await assert.rejects(
    diagnosePostgresSchemaReadOnly(
      { async connect() { return client; } },
      () => assert.fail("must not emit read-only PASS"),
    ),
    /did not confirm a read-only diagnostic transaction/,
  );
  assert.deepEqual(calls, [
    "BEGIN READ ONLY",
    "SELECT current_setting('transaction_read_only') AS transaction_read_only",
    "ROLLBACK",
    "RELEASE",
  ]);
});

test("diagnostic implementation contains no database mutation statements or normal certification calls", async () => {
  const [diagnostic, runner] = await Promise.all([
    readFile(resolve(import.meta.dirname, "postgres-schema-diagnostic.mjs"), "utf8"),
    readFile(resolve(import.meta.dirname, "staging-postgres-certification.mjs"), "utf8"),
  ]);
  assert.doesNotMatch(diagnostic, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
  const branch = runner.indexOf('process.argv[2] === "--diagnose-schema"');
  const mode = runner.slice(branch, runner.indexOf("const sourcePath", branch));
  assert.doesNotMatch(mode, /provisionApplicationRole|migrate-foundation-state|import-foundation-state|POSTGRES_LIVE_ADAPTER_TESTS|verifyEfsSource/);
});
