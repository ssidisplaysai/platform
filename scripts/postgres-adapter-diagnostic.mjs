export const BUSINESS_NAMESPACES = Object.freeze(["share-to-grow-repository"]);
export const CERTIFICATION_NAMESPACE_PREFIXES = Object.freeze([
  "certification-integration-",
  "certification-concurrency-",
  "staging-certification:",
]);

export function classifyNamespace(namespace) {
  if (BUSINESS_NAMESPACES.includes(namespace)) return "BUSINESS_NAMESPACE";
  if (CERTIFICATION_NAMESPACE_PREFIXES.some((prefix) => namespace.startsWith(prefix))) {
    return "CERTIFICATION_TEST_NAMESPACE";
  }
  return "UNKNOWN";
}

export const ROW_INVENTORY_QUERY = `SELECT namespace, schema_version, revision::text AS revision, updated_at,
       jsonb_typeof(data) = 'object' AS data_is_object
FROM public.genesis_foundation_state
ORDER BY namespace`;

export async function inventoryFoundationRows(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const mode = await client.query("SELECT current_setting('transaction_read_only') AS transaction_read_only");
    if (mode.rows[0]?.transaction_read_only !== "on") {
      throw new Error("PostgreSQL did not confirm a read-only inventory transaction");
    }
    const result = await client.query(ROW_INVENTORY_QUERY);
    return result.rows.map((row) => ({
      namespace: row.namespace,
      schema_version: row.schema_version,
      revision: row.revision,
      updated_at: new Date(row.updated_at).toISOString(),
      data_is_object: row.data_is_object === true,
      classification: classifyNamespace(row.namespace),
    }));
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}
