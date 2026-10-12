import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { runner } from "node-pg-migrate";
import { postgresClientConfig } from "./postgres-connection.mjs";

export const APPROVED_MIGRATION_FILES = Object.freeze([
  "20261009000000_foundation_state.js",
  "20261010204600_add_foundation_state_constraints.js",
]);

export const EXPECTED_PRODUCTION_HOST = "genesis-production-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com";
export const EXPECTED_PRODUCTION_DATABASE = "genesis";
export const EXPECTED_PRODUCTION_PORT = 5432;
export const EXPECTED_BUSINESS_NAMESPACE = "share-to-grow-repository";

const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export function parseDirection(argv = process.argv) {
  const direction = argv[2] ?? "up";
  if (direction !== "up") {
    throw new Error("Production foundation migration only supports direction 'up'.");
  }
  return direction;
}

export function assertProductionGuards(environment = process.env) {
  if (environment.GENESIS_ENVIRONMENT !== "production") {
    throw new Error("GENESIS_ENVIRONMENT must be exactly 'production' for this runner.");
  }
  if (environment.GENESIS_ALLOW_PRODUCTION_FOUNDATION_MIGRATION !== "1") {
    throw new Error("GENESIS_ALLOW_PRODUCTION_FOUNDATION_MIGRATION must be '1' to authorize production migration.");
  }
  if ((environment.DB_HOST ?? "").trim().toLowerCase() !== EXPECTED_PRODUCTION_HOST) {
    throw new Error("DB_HOST does not match the approved production endpoint.");
  }
  if ((environment.DB_NAME ?? "").trim() !== EXPECTED_PRODUCTION_DATABASE) {
    throw new Error("DB_NAME does not match the approved production database.");
  }
  if (Number((environment.DB_PORT ?? "").trim() || "5432") !== EXPECTED_PRODUCTION_PORT) {
    throw new Error("DB_PORT must be 5432 for approved production migration target.");
  }
  if (!environment.GENESIS_RDS_CA_CERT?.trim()) {
    throw new Error("GENESIS_RDS_CA_CERT is required for strict TLS verification.");
  }
}

export function assertApprovedMigrationSet(files) {
  const normalized = [...files].sort();
  const approved = [...APPROVED_MIGRATION_FILES].sort();
  if (JSON.stringify(normalized) !== JSON.stringify(approved)) {
    throw new Error(
      `Unexpected migration set for production run. expected=${approved.join(",")} actual=${normalized.join(",")}`,
    );
  }
}

export function buildRunnerOptions(databaseConfig) {
  return {
    databaseUrl: databaseConfig,
    direction: "up",
    dir: migrationDirectory,
    migrationsTable: "genesis_schema_migrations",
    schema: "public",
    createSchema: false,
    createMigrationsSchema: false,
    checkOrder: true,
    singleTransaction: true,
  };
}

export async function readPreMigrationState(client) {
  const result = await client.query(`
    SELECT
      to_regclass('public.genesis_foundation_state') IS NOT NULL AS foundation_exists,
      to_regclass('public.genesis_schema_migrations') IS NOT NULL AS migrations_exists
  `);
  const state = result.rows[0];
  let foundationRows = 0;
  let businessRows = 0;
  if (state.foundation_exists) {
    const rowCounts = await client.query(
      `SELECT count(*)::integer AS total,
              count(*) FILTER (WHERE namespace = $1)::integer AS business
       FROM public.genesis_foundation_state`,
      [EXPECTED_BUSINESS_NAMESPACE],
    );
    foundationRows = rowCounts.rows[0]?.total ?? 0;
    businessRows = rowCounts.rows[0]?.business ?? 0;
  }
  return {
    foundationExists: state.foundation_exists === true,
    migrationsExists: state.migrations_exists === true,
    foundationRows,
    businessRows,
  };
}

export function assertPreMigrationState(state) {
  if (state.foundationExists || state.migrationsExists || state.foundationRows !== 0 || state.businessRows !== 0) {
    throw new Error(
      `Unexpected existing production foundation state: foundationExists=${state.foundationExists} `
      + `migrationsExists=${state.migrationsExists} foundationRows=${state.foundationRows} businessRows=${state.businessRows}`,
    );
  }
}

export async function verifyPostMigrationState(client) {
  const constraints = await client.query(`
    SELECT conname::text AS name
    FROM pg_constraint
    WHERE conrelid = 'public.genesis_foundation_state'::regclass
    ORDER BY conname
  `);
  const names = constraints.rows.map((row) => row.name);
  for (const required of [
    "genesis_foundation_state_pkey",
    "genesis_foundation_state_revision_nonnegative",
    "genesis_foundation_state_data_object",
  ]) {
    if (!names.includes(required)) {
      throw new Error(`Missing required post-migration constraint: ${required}`);
    }
  }

  const migrationRows = await client.query(`
    SELECT name::text AS name, count(*)::integer AS count
    FROM public.genesis_schema_migrations
    GROUP BY name
    ORDER BY name
  `);
  const migrationCounts = new Map(migrationRows.rows.map((row) => [row.name, row.count]));
  for (const migrationName of APPROVED_MIGRATION_FILES.map((name) => name.replace(/\.js$/, ""))) {
    if (migrationCounts.get(migrationName) !== 1) {
      throw new Error(`Expected exactly one migration record for ${migrationName}.`);
    }
  }
}

export async function runProductionFoundationMigration(environment = process.env) {
  parseDirection(process.argv);
  assertProductionGuards(environment);

  const migrationFiles = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".js"))
    .sort();
  assertApprovedMigrationSet(migrationFiles);

  const config = postgresClientConfig(environment);
  const precheckClient = new Client({ ...config, application_name: "genesis-production-foundation-migration-precheck" });
  try {
    await precheckClient.connect();
    assertPreMigrationState(await readPreMigrationState(precheckClient));
  } finally {
    await precheckClient.end();
  }

  await runner(buildRunnerOptions(config));

  const verifyClient = new Client({ ...config, application_name: "genesis-production-foundation-migration-verify" });
  try {
    await verifyClient.connect();
    await verifyPostMigrationState(verifyClient);
  } finally {
    await verifyClient.end();
  }

  console.log("FOUNDATION_MIGRATION_PRODUCTION=PASS");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await runProductionFoundationMigration();
}
