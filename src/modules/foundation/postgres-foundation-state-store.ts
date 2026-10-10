import { existsSync, readFileSync } from "node:fs";
import { Pool, type PoolConfig } from "pg";
import {
  FoundationPersistenceConflictError,
  FoundationPersistenceError,
  FoundationPersistenceSerializationError,
} from "./foundation-persistence";
import type { FoundationStateLoad, FoundationStateStore } from "./foundation-state-store";

const SCHEMA_VERSION = 1;
const STATE_TABLE = "public.genesis_foundation_state";
const MAX_POOL_SIZE = 5;
const CONNECTION_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT_MS = 5_000;

type StateEnvelope<T> = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  data: T;
};

type StateRow<T> = {
  schema_version: number;
  revision: string;
  updated_at: Date | string;
  data: T;
};

function configurationError(message: string, code: string): FoundationPersistenceError {
  console.error(JSON.stringify({ event: "GENESIS_PERSISTENCE_CONFIGURATION_FAILED", code }));
  return new FoundationPersistenceError(message, code);
}

function sslConfig(): PoolConfig["ssl"] {
  const configuredCa = process.env.GENESIS_RDS_CA_CERT?.trim();
  if (!configuredCa) return { rejectUnauthorized: true };

  const ca = configuredCa.includes("-----BEGIN CERTIFICATE-----")
    ? configuredCa
    : existsSync(configuredCa)
      ? readFileSync(configuredCa, "utf8")
      : undefined;
  if (!ca) {
    throw configurationError(
      "GENESIS_RDS_CA_CERT must contain a PEM certificate or reference an existing PEM file.",
      "PERSISTENCE_TLS_CONFIGURATION_INVALID",
    );
  }
  return { ca, rejectUnauthorized: true };
}

function createPool(): Pool {
  const host = process.env.DB_HOST?.trim();
  const database = process.env.DB_NAME?.trim();
  const user = process.env.DB_USERNAME?.trim();
  const password = process.env.DB_PASSWORD;
  const rawPort = process.env.DB_PORT?.trim() || "5432";
  const port = Number(rawPort);
  if (!host || !database || !user || !password || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw configurationError(
      "PostgreSQL persistence requires valid DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, and DB_PASSWORD configuration.",
      "PERSISTENCE_DATABASE_CONFIGURATION_INVALID",
    );
  }

  return new Pool({
    host,
    port,
    database,
    user,
    password,
    max: MAX_POOL_SIZE,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: 30_000,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS + CONNECTION_TIMEOUT_MS,
    application_name: "genesis-share-to-grow",
    ssl: sslConfig(),
  });
}

let pool: Pool | undefined;

function getPool(): Pool {
  pool ??= createPool();
  return pool;
}

function databaseErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "UNKNOWN";
}

function logDatabaseFailure(event: string, error: unknown): void {
  console.error(JSON.stringify({
    event,
    backend: "postgres",
    databaseErrorCode: databaseErrorCode(error),
  }));
}

function validRevision(revision: string, namespace: string): number {
  const value = Number(revision);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new FoundationPersistenceSerializationError(
      `Persisted revision for ${namespace} is outside the supported safe integer range.`,
    );
  }
  return value;
}

function deserializeEnvelope<T>(row: StateRow<T>, namespace: string): StateEnvelope<T> {
  const revision = validRevision(row.revision, namespace);
  if (row.schema_version !== SCHEMA_VERSION || row.data === null || typeof row.data !== "object") {
    throw new FoundationPersistenceSerializationError(
      `Persisted state for ${namespace} has an unsupported schema or malformed data.`,
    );
  }
  const updatedAtDate = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
  if (Number.isNaN(updatedAtDate.getTime())) {
    throw new FoundationPersistenceSerializationError(
      `Persisted state for ${namespace} has an invalid updatedAt value.`,
    );
  }
  const updatedAt = updatedAtDate.toISOString();
  return {
    schemaVersion: row.schema_version,
    revision,
    updatedAt,
    data: row.data,
  };
}

async function load<T>(input: {
  namespace: string;
  seedFactory: () => T;
}): Promise<FoundationStateLoad<T>> {
  try {
    const result = await getPool().query<StateRow<T>>(
      `SELECT schema_version, revision, updated_at, data
       FROM ${STATE_TABLE}
       WHERE namespace = $1`,
      [input.namespace],
    );
    const row = result.rows[0];
    if (!row) {
      return {
        state: structuredClone(input.seedFactory()),
        revision: 0,
        seeded: true,
      };
    }
    const envelope = deserializeEnvelope(row, input.namespace);
    return {
      state: structuredClone(envelope.data),
      revision: envelope.revision,
      seeded: false,
    };
  } catch (error) {
    if (error instanceof FoundationPersistenceError) throw error;
    logDatabaseFailure("GENESIS_PERSISTENCE_READ_FAILED", error);
    throw new FoundationPersistenceError(
      `Failed to load persisted state for ${input.namespace}.`,
      "PERSISTENCE_READ_FAILED",
    );
  }
}

async function save<T>(input: {
  namespace: string;
  state: T;
  expectedRevision: number;
}): Promise<{ revision: number }> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new FoundationPersistenceConflictError(
      `Invalid expected persistence revision for ${input.namespace}.`,
    );
  }

  const data = JSON.stringify(input.state);
  const client = getPool();
  try {
    if (input.expectedRevision === 0) {
      const inserted = await client.query<{ revision: string }>(
        `INSERT INTO ${STATE_TABLE} (namespace, schema_version, revision, updated_at, data)
         VALUES ($1, $2, 1, clock_timestamp(), $3::jsonb)
         ON CONFLICT (namespace) DO NOTHING
         RETURNING revision`,
        [input.namespace, SCHEMA_VERSION, data],
      );
      if (inserted.rowCount === 1) return { revision: 1 };
    } else {
      const updated = await client.query<{ revision: string }>(
        `UPDATE ${STATE_TABLE}
         SET revision = revision + 1, updated_at = clock_timestamp(), data = $3::jsonb
         WHERE namespace = $1 AND schema_version = $2 AND revision = $4
         RETURNING revision`,
        [input.namespace, SCHEMA_VERSION, data, input.expectedRevision],
      );
      if (updated.rowCount === 1 && updated.rows[0]) {
        return { revision: validRevision(updated.rows[0].revision, input.namespace) };
      }
    }

    const current = await client.query<{ schema_version: number; revision: string }>(
      `SELECT schema_version, revision FROM ${STATE_TABLE} WHERE namespace = $1`,
      [input.namespace],
    );
    const actual = current.rows[0]
      ? `${current.rows[0].revision}${current.rows[0].schema_version !== SCHEMA_VERSION ? ", unsupported schema" : ""}`
      : "missing state";
    console.error(JSON.stringify({
      event: "GENESIS_PERSISTENCE_REVISION_CONFLICT",
      backend: "postgres",
      namespace: input.namespace,
      expectedRevision: input.expectedRevision,
    }));
    throw new FoundationPersistenceConflictError(
      `Revision conflict for ${input.namespace}: expected ${input.expectedRevision}, found ${actual}.`,
    );
  } catch (error) {
    if (error instanceof FoundationPersistenceError) throw error;
    logDatabaseFailure("GENESIS_PERSISTENCE_WRITE_FAILED", error);
    throw new FoundationPersistenceError(
      `Failed to save persisted state for ${input.namespace}.`,
      "PERSISTENCE_WRITE_FAILED",
    );
  }
}

async function reset<T>(input: {
  namespace: string;
  seedFactory: () => T;
}): Promise<{ state: T; revision: number }> {
  if (process.env.NODE_ENV !== "test") {
    throw new FoundationPersistenceError(
      "Resetting PostgreSQL persistence is only supported in tests.",
      "PERSISTENCE_RESET_NOT_ALLOWED",
    );
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM ${STATE_TABLE} WHERE namespace = $1`, [input.namespace]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    logDatabaseFailure("GENESIS_PERSISTENCE_TEST_RESET_FAILED", error);
    throw new FoundationPersistenceError(
      "Failed to reset test persistence state.",
      "PERSISTENCE_TEST_RESET_FAILED",
    );
  } finally {
    client.release();
  }
  const state = structuredClone(input.seedFactory());
  return { state, revision: 0 };
}

async function check(): Promise<void> {
  try {
    await getPool().query(
      `SELECT schema_version, revision, updated_at, data
       FROM ${STATE_TABLE}
       LIMIT 0`,
    );
  } catch (error) {
    if (error instanceof FoundationPersistenceError) {
      console.error(JSON.stringify({
        event: "GENESIS_PERSISTENCE_SCHEMA_MISMATCH",
        backend: "postgres",
        code: error.code,
      }));
      throw error;
    }
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error.code === "42P01" || error.code === "42703")
    ) {
      console.error(JSON.stringify({
        event: "GENESIS_PERSISTENCE_SCHEMA_MISMATCH",
        backend: "postgres",
        code: "PERSISTENCE_SCHEMA_MISMATCH",
      }));
      throw new FoundationPersistenceError(
        "PostgreSQL persistence schema is not installed or is incompatible.",
        "PERSISTENCE_SCHEMA_MISMATCH",
      );
    }
    logDatabaseFailure("GENESIS_PERSISTENCE_CONNECTION_FAILED", error);
    throw new FoundationPersistenceError(
      "PostgreSQL persistence is unavailable.",
      "PERSISTENCE_CONNECTION_FAILED",
    );
  }
}

async function close(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}

export function createPostgresFoundationStateStore(): FoundationStateStore {
  return {
    backend: "postgres",
    load,
    save,
    reset,
    check,
    close,
  };
}
