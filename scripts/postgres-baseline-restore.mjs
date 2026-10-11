import { createHash } from "node:crypto";

export const BUSINESS_NAMESPACE = "share-to-grow-repository";
export const KNOWN_SYNTHETIC_RECEIPTS = Object.freeze([
  "staging-af-A-unpaid",
  "staging-af-B-paid",
  "staging-af-C-paid",
  "staging-af-C-cancel",
  "staging-af-D-paid",
  "staging-af-D-refund20",
  "staging-af-E-paid",
  "staging-af-E-refund20",
  "staging-af-E-refund40",
  "staging-af-F-paid",
  "staging-af-F-refund50",
]);

const PRECHECK_QUERY = `SELECT
  (SELECT count(*)::integer FROM public.genesis_foundation_state) AS row_count,
  namespace,
  schema_version,
  revision::text AS revision,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
  data::text AS canonical_text,
  (
    SELECT array_agg(receipt->>'sourceEventId' ORDER BY receipt->>'sourceEventId')
    FROM jsonb_array_elements(data->'sourceEventReceipts') AS receipt
  ) AS source_event_ids
FROM public.genesis_foundation_state
WHERE namespace = $1
FOR UPDATE`;

const UPDATE_QUERY = `UPDATE public.genesis_foundation_state
SET schema_version = $2, revision = $3, updated_at = $4::timestamptz, data = $5::jsonb
WHERE namespace = $1
  AND schema_version = $6
  AND revision = $7
  AND updated_at = $8::timestamptz`;

const POSTCHECK_QUERY = `SELECT
  (SELECT count(*)::integer FROM public.genesis_foundation_state) AS row_count,
  namespace,
  schema_version,
  revision::text AS revision,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
  data::text AS canonical_text
FROM public.genesis_foundation_state
WHERE namespace = $1`;

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalDataHash(data) {
  return createHash("sha256").update(stableJson(data), "utf8").digest("hex");
}

function canonicalSet(values) {
  return [...new Set(values)].sort();
}

function isSameSet(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function verifySyntheticReceiptDelta({
  sourceEventIds,
  sourceEnvelopeEventIds,
  allowedSyntheticReceiptIds = KNOWN_SYNTHETIC_RECEIPTS,
}) {
  const actual = canonicalSet(sourceEventIds);
  const baseline = canonicalSet(sourceEnvelopeEventIds);
  const allowed = canonicalSet(allowedSyntheticReceiptIds);
  const extra = actual.filter((id) => !baseline.includes(id));
  if (!isSameSet(extra, allowed)) {
    throw new Error("precheck failed: sourceEventReceipt delta differs from the approved synthetic certification set");
  }
}

export async function restorePostgresBaselineFromCertifiedEfs({
  pool,
  sourceEnvelope,
  sourceCanonicalHash,
  expectedPreRestore,
  allowedSyntheticReceiptIds = KNOWN_SYNTHETIC_RECEIPTS,
}) {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    const precheck = await client.query(PRECHECK_QUERY, [BUSINESS_NAMESPACE]);
    if (precheck.rowCount !== 1) {
      throw new Error("precheck failed: business namespace did not return exactly one row");
    }
    const row = precheck.rows[0];
    if (row.row_count !== 1 || row.namespace !== BUSINESS_NAMESPACE) {
      throw new Error("precheck failed: foundation table does not contain exactly one business namespace row");
    }
    if (
      row.schema_version !== expectedPreRestore.schemaVersion
      || row.revision !== String(expectedPreRestore.revision)
      || row.updated_at !== expectedPreRestore.updatedAt
    ) {
      throw new Error("precheck failed: business namespace metadata differs from the expected pre-restore state");
    }
    const preHash = createHash("sha256").update(row.canonical_text, "utf8").digest("hex");
    if (preHash !== expectedPreRestore.canonicalHash) {
      throw new Error("precheck failed: business namespace canonical hash differs from expectation");
    }

    verifySyntheticReceiptDelta({
      sourceEventIds: row.source_event_ids ?? [],
      sourceEnvelopeEventIds: (sourceEnvelope.data?.sourceEventReceipts ?? [])
        .map((receipt) => receipt?.sourceEventId)
        .filter((id) => typeof id === "string"),
      allowedSyntheticReceiptIds,
    });

    const update = await client.query(UPDATE_QUERY, [
      BUSINESS_NAMESPACE,
      sourceEnvelope.schemaVersion,
      sourceEnvelope.revision,
      sourceEnvelope.updatedAt,
      JSON.stringify(sourceEnvelope.data),
      expectedPreRestore.schemaVersion,
      expectedPreRestore.revision,
      expectedPreRestore.updatedAt,
    ]);
    if (update.rowCount !== 1) {
      throw new Error("restore update affected zero or multiple rows");
    }

    const postcheck = await client.query(POSTCHECK_QUERY, [BUSINESS_NAMESPACE]);
    if (postcheck.rowCount !== 1) {
      throw new Error("postcheck failed: business namespace did not return exactly one row");
    }
    const after = postcheck.rows[0];
    if (
      after.row_count !== 1
      || after.namespace !== BUSINESS_NAMESPACE
      || after.schema_version !== sourceEnvelope.schemaVersion
      || after.revision !== String(sourceEnvelope.revision)
      || after.updated_at !== sourceEnvelope.updatedAt
    ) {
      throw new Error("postcheck failed: business namespace metadata does not match the certified EFS envelope");
    }
    const postHash = createHash("sha256").update(after.canonical_text, "utf8").digest("hex");
    if (postHash !== sourceCanonicalHash || canonicalDataHash(sourceEnvelope.data) !== sourceCanonicalHash) {
      throw new Error("postcheck failed: canonical hash mismatch after restore");
    }

    await client.query("COMMIT");
    committed = true;

    return {
      rowsUpdated: update.rowCount,
      before: {
        rowCount: row.row_count,
        namespace: row.namespace,
        schemaVersion: row.schema_version,
        revision: Number(row.revision),
        updatedAt: row.updated_at,
        canonicalHash: preHash,
      },
      after: {
        rowCount: after.row_count,
        namespace: after.namespace,
        schemaVersion: after.schema_version,
        revision: Number(after.revision),
        updatedAt: after.updated_at,
        canonicalHash: postHash,
      },
    };
  } catch (error) {
    if (!committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // preserve original failure
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
