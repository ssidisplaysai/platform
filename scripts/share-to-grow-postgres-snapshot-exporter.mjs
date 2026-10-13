import { buildSnapshotMetadata, SHARE_TO_GROW_NAMESPACE } from "./share-to-grow-snapshot-export-lib.mjs";

export const POSTGRES_READ_ONLY_MODE_QUERY = "SELECT current_setting('transaction_read_only') AS transaction_read_only";
export const POSTGRES_SNAPSHOT_QUERY = `SELECT schema_version, revision::text AS revision, updated_at, data
FROM public.genesis_foundation_state
WHERE namespace = $1`;

export async function readPostgresShareToGrowSnapshot({
  pool,
  namespace = SHARE_TO_GROW_NAMESPACE,
  capturedAt = new Date().toISOString(),
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const mode = await client.query(POSTGRES_READ_ONLY_MODE_QUERY);
    if (mode.rows[0]?.transaction_read_only !== "on") {
      throw new Error("POSTGRES_READ_ONLY_TRANSACTION_REQUIRED");
    }
    const result = await client.query(POSTGRES_SNAPSHOT_QUERY, [namespace]);
    if (result.rowCount !== 1) {
      throw new Error("POSTGRES_NAMESPACE_SNAPSHOT_NOT_FOUND");
    }
    const row = result.rows[0];
    const envelope = {
      schemaVersion: row.schema_version,
      revision: Number(row.revision),
      updatedAt: new Date(row.updated_at).toISOString(),
      data: row.data,
    };
    if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 0) {
      throw new Error("POSTGRES_SNAPSHOT_REVISION_INVALID");
    }
    const rawText = JSON.stringify(envelope);
    const metadata = buildSnapshotMetadata({
      backend: "postgres",
      namespace,
      envelope,
      rawText,
      capturedAt,
    });
    return { envelope, rawText, metadata };
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}

