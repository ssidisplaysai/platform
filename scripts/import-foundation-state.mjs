import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { postgresClientConfig } from "./postgres-connection.mjs";

const options = new Set(process.argv.slice(2));
const valueAfter = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const sourcePath = valueAfter("--source");
const namespace = valueAfter("--namespace");
const dryRun = options.has("--dry-run");
const confirmed = options.has("--confirm-staging-target");

if (!sourcePath || !namespace || (!dryRun && !confirmed)) {
  throw new Error(
    "Usage: node scripts/import-foundation-state.mjs --source <envelope.json> --namespace <name> --dry-run | --confirm-staging-target",
  );
}
if (process.env.GENESIS_ENVIRONMENT !== "staging") {
  throw new Error("State import is allowed only with GENESIS_ENVIRONMENT=staging.");
}

const config = postgresClientConfig();
const expectedStagingHost = process.env.GENESIS_STAGING_DATABASE_HOST?.trim().toLowerCase();
const expectedStagingDatabase = process.env.GENESIS_STAGING_DATABASE_NAME?.trim();
if (!expectedStagingHost || !expectedStagingDatabase) {
  throw new Error(
    "State import requires GENESIS_STAGING_DATABASE_HOST and GENESIS_STAGING_DATABASE_NAME to identify the approved staging target.",
  );
}
if (
  config.host.toLowerCase() !== expectedStagingHost
  || config.database !== expectedStagingDatabase
  || /prod/i.test(config.database)
  || /prod/i.test(config.host)
) {
  throw new Error("Configured database target does not match the approved staging target.");
}

const raw = await readFile(sourcePath);
const checksum = createHash("sha256").update(raw).digest("hex");
let envelope;
try {
  envelope = JSON.parse(raw.toString("utf8"));
} catch {
  throw new Error("Source state envelope is not valid JSON.");
}
if (
  envelope === null
  || typeof envelope !== "object"
  || envelope.schemaVersion !== 1
  || !Number.isSafeInteger(envelope.revision)
  || envelope.revision < 0
  || typeof envelope.updatedAt !== "string"
  || Number.isNaN(Date.parse(envelope.updatedAt))
  || envelope.data === null
  || typeof envelope.data !== "object"
  || Array.isArray(envelope.data)
) {
  throw new Error("Source state envelope has an unsupported schema or invalid metadata.");
}

const collectionNames = [
  "participants",
  "trackingIdentities",
  "ruleVersions",
  "ledgerEntries",
  "sourceEventReceipts",
  "processedCommerceLines",
  "payoutEntitlements",
  "commerceAdjustments",
];
const counts = Object.fromEntries(collectionNames.map((key) => [
  key,
  Array.isArray(envelope.data[key]) ? envelope.data[key].length : 0,
]));
if (collectionNames.some((key) => !Array.isArray(envelope.data[key]))) {
  throw new Error("Source Share-to-Grow state is missing one or more required collections.");
}

const pool = new Pool({ ...config, max: 1, idleTimeoutMillis: 5_000 });
try {
  const destination = await pool.query(
    "SELECT schema_version, revision FROM public.genesis_foundation_state WHERE namespace = $1",
    [namespace],
  );
  if (destination.rowCount !== 0) {
    throw new Error(`Destination namespace ${namespace} is not empty; refusing overwrite.`);
  }

  if (!dryRun) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO public.genesis_foundation_state
           (namespace, schema_version, revision, updated_at, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (namespace) DO NOTHING
         RETURNING namespace`,
        [namespace, envelope.schemaVersion, envelope.revision, envelope.updatedAt, JSON.stringify(envelope.data)],
      );
      if (inserted.rowCount !== 1) {
        throw new Error(`Destination namespace ${namespace} became populated; refusing overwrite.`);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log(JSON.stringify({
    outcome: dryRun ? "DRY_RUN_VALIDATED" : "IMPORTED",
    namespace,
    revision: envelope.revision,
    schemaVersion: envelope.schemaVersion,
    sha256: checksum,
    counts,
  }));
} finally {
  await pool.end();
}
