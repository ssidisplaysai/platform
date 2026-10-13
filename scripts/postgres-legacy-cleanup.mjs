import { createHash } from "node:crypto";

export const BUSINESS_NAMESPACE = "share-to-grow-repository";
export const LEGACY_CERTIFICATION_NAMESPACES = Object.freeze([
  "staging-certification:00a3d67c-55b0-4a79-8431-76fbd1ca23d6",
  "staging-certification:7fa569e9-5911-4d7a-9548-f0bb2b4e3522",
]);
export const EXPECTED_BUSINESS_REVISION = "24";

const LIST_QUERY = "SELECT namespace FROM public.genesis_foundation_state ORDER BY namespace";
const SNAPSHOT_QUERY = `SELECT namespace, schema_version, revision::text AS revision, updated_at,
       jsonb_typeof(data) = 'object' AS data_is_object, data::text AS canonical_text
FROM public.genesis_foundation_state
WHERE namespace = $1`;
const DELETE_QUERY = `DELETE FROM public.genesis_foundation_state
WHERE namespace = $1 OR namespace = $2`;

function sameSet(actual, expected) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function snapshotBusiness(client) {
  const result = await client.query(SNAPSHOT_QUERY, [BUSINESS_NAMESPACE]);
  if (result.rows.length !== 1) throw new Error("business namespace snapshot did not return exactly one row");
  const row = result.rows[0];
  return {
    namespace: row.namespace,
    schema_version: row.schema_version,
    revision: row.revision,
    updated_at: new Date(row.updated_at).toISOString(),
    data_is_object: row.data_is_object === true,
    // jsonb::text is deterministic, so this hash is a stable canonical document hash.
    sha256: createHash("sha256").update(row.canonical_text, "utf8").digest("hex"),
  };
}

async function listNamespaces(client) {
  return (await client.query(LIST_QUERY)).rows.map(({ namespace }) => namespace);
}

export async function cleanupLegacyCertificationRows(pool) {
  const client = await pool.connect();
  let before;
  let deleted;
  let inTransactionAfter;
  let committed = false;
  try {
    await client.query("BEGIN");
    const namespaces = await listNamespaces(client);
    const expected = [BUSINESS_NAMESPACE, ...LEGACY_CERTIFICATION_NAMESPACES];
    if (!sameSet(namespaces, expected)) {
      throw new Error(`precheck failed: expected exactly ${expected.length} known namespaces, found ${namespaces.length}`);
    }
    before = await snapshotBusiness(client);
    if (before.revision !== EXPECTED_BUSINESS_REVISION || !before.data_is_object) {
      throw new Error("precheck failed: business namespace revision or JSON type differs from expectation");
    }
    const result = await client.query(DELETE_QUERY, LEGACY_CERTIFICATION_NAMESPACES);
    deleted = result.rowCount;
    if (deleted !== 2) throw new Error(`delete affected ${deleted} rows instead of 2`);
    inTransactionAfter = await listNamespaces(client);
    if (!sameSet(inTransactionAfter, [BUSINESS_NAMESPACE])) {
      throw new Error("in-transaction verification failed: business namespace is not the only remaining row");
    }
    await client.query("COMMIT");
    committed = true;
  } catch (error) {
    if (!committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The original error is the useful one.
      }
    }
    throw error;
  } finally {
    client.release();
  }

  const afterClient = await pool.connect();
  try {
    const namespaces = await listNamespaces(afterClient);
    const after = await snapshotBusiness(afterClient);
    if (
      !sameSet(namespaces, [BUSINESS_NAMESPACE])
      || JSON.stringify(after) !== JSON.stringify(before)
    ) {
      throw new Error("post-commit verification failed: business namespace changed or extra rows remain");
    }
    return { before, after, deleted, namespaces };
  } finally {
    afterClient.release();
  }
}
