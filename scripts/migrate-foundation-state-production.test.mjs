import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  APPROVED_MIGRATION_FILES,
  EXPECTED_PRODUCTION_DATABASE,
  EXPECTED_PRODUCTION_HOST,
  EXPECTED_PRODUCTION_PORT,
  assertApprovedMigrationSet,
  assertPreMigrationState,
  assertProductionGuards,
  buildRunnerOptions,
  parseDirection,
} from "./migrate-foundation-state-production.mjs";

const baseEnvironment = {
  GENESIS_ENVIRONMENT: "production",
  GENESIS_ALLOW_PRODUCTION_FOUNDATION_MIGRATION: "1",
  DB_HOST: EXPECTED_PRODUCTION_HOST,
  DB_NAME: EXPECTED_PRODUCTION_DATABASE,
  DB_PORT: String(EXPECTED_PRODUCTION_PORT),
  GENESIS_RDS_CA_CERT: "/workspace/certs/aws-rds-global-bundle.pem",
};

test("production runner requires GENESIS_ENVIRONMENT=production", () => {
  assert.throws(
    () => assertProductionGuards({ ...baseEnvironment, GENESIS_ENVIRONMENT: "staging" }),
    /GENESIS_ENVIRONMENT must be exactly 'production'/,
  );
});

test("production runner requires explicit authorization env", () => {
  assert.throws(
    () => assertProductionGuards({ ...baseEnvironment, GENESIS_ALLOW_PRODUCTION_FOUNDATION_MIGRATION: "0" }),
    /GENESIS_ALLOW_PRODUCTION_FOUNDATION_MIGRATION must be '1'/,
  );
});

test("production runner enforces exact host and database", () => {
  assert.throws(
    () => assertProductionGuards({ ...baseEnvironment, DB_HOST: "other-host" }),
    /DB_HOST does not match/,
  );
  assert.throws(
    () => assertProductionGuards({ ...baseEnvironment, DB_NAME: "other_db" }),
    /DB_NAME does not match/,
  );
  assert.throws(
    () => assertProductionGuards({ ...baseEnvironment, DB_PORT: "5433" }),
    /DB_PORT must be 5432/,
  );
});

test("production runner does not support down direction", () => {
  assert.equal(parseDirection(["node", "script"]), "up");
  assert.throws(
    () => parseDirection(["node", "script", "down"]),
    /only supports direction 'up'/,
  );
});

test("production runner allowlist accepts only exact approved migrations", () => {
  assert.doesNotThrow(() => assertApprovedMigrationSet(APPROVED_MIGRATION_FILES));
  assert.throws(
    () => assertApprovedMigrationSet([...APPROVED_MIGRATION_FILES, "20261011000000_extra.js"]),
    /Unexpected migration set/,
  );
});

test("pre-migration state fails closed on existing objects or business rows", () => {
  assert.throws(
    () => assertPreMigrationState({ foundationExists: true, migrationsExists: false, foundationRows: 0, businessRows: 0 }),
    /Unexpected existing production foundation state/,
  );
  assert.throws(
    () => assertPreMigrationState({ foundationExists: false, migrationsExists: true, foundationRows: 0, businessRows: 0 }),
    /Unexpected existing production foundation state/,
  );
  assert.throws(
    () => assertPreMigrationState({ foundationExists: false, migrationsExists: false, foundationRows: 1, businessRows: 0 }),
    /Unexpected existing production foundation state/,
  );
  assert.throws(
    () => assertPreMigrationState({ foundationExists: false, migrationsExists: false, foundationRows: 0, businessRows: 1 }),
    /Unexpected existing production foundation state/,
  );
  assert.doesNotThrow(
    () => assertPreMigrationState({ foundationExists: false, migrationsExists: false, foundationRows: 0, businessRows: 0 }),
  );
});

test("runner options are single-transaction and ordered", () => {
  const options = buildRunnerOptions({ host: "h", port: 5432, database: "d", user: "u", password: "p", ssl: { rejectUnauthorized: true } });
  assert.equal(options.direction, "up");
  assert.equal(options.singleTransaction, true);
  assert.equal(options.checkOrder, true);
  assert.equal(options.migrationsTable, "genesis_schema_migrations");
  assert.equal(options.schema, "public");
});

test("production runner source does not log secret values", async () => {
  const source = await readFile(resolve(import.meta.dirname, "./migrate-foundation-state-production.mjs"), "utf8");
  assert.doesNotMatch(source, /console\.log\(.*DB_PASSWORD/i);
  assert.doesNotMatch(source, /console\.log\(.*process\.env/i);
});

test("generic migration runner remains production-blocked", async () => {
  const source = await readFile(resolve(import.meta.dirname, "./migrate-foundation-state.mjs"), "utf8");
  assert.match(source, /GENESIS_ENVIRONMENT === "production"/);
  assert.match(source, /Production migrations are prohibited by this command\./);
});
