import assert from "node:assert/strict";
import test from "node:test";
import {
  POSTGRES_READ_ONLY_MODE_QUERY,
  POSTGRES_SNAPSHOT_QUERY,
  readPostgresShareToGrowSnapshot,
} from "./share-to-grow-postgres-snapshot-exporter.mjs";

function fakePool({ row, readOnly = "on", rowCount = 1 }) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql === "BEGIN READ ONLY") return { rows: [] };
      if (sql === POSTGRES_READ_ONLY_MODE_QUERY) return { rows: [{ transaction_read_only: readOnly }] };
      if (sql === POSTGRES_SNAPSHOT_QUERY) {
        return { rowCount, rows: rowCount === 1 ? [row] : [] };
      }
      if (sql === "ROLLBACK") return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  };
  return {
    calls,
    pool: { connect: async () => client },
  };
}

test("reads share-to-grow snapshot with read-only transaction and no writes", async () => {
  const sourceRow = {
    schema_version: 1,
    revision: "38",
    updated_at: "2026-10-13T07:46:02.381Z",
    data: {
      participants: [],
      trackingIdentities: [],
      ruleVersions: [],
      ledgerEntries: [],
      sourceEventReceipts: [],
      processedCommerceLines: [],
      payoutEntitlements: [],
      commerceAdjustments: [],
    },
  };
  const { pool, calls } = fakePool({ row: sourceRow });
  const output = await readPostgresShareToGrowSnapshot({
    pool,
    namespace: "share-to-grow-repository",
    capturedAt: "2026-10-13T20:00:00.000Z",
  });

  assert.equal(output.envelope.revision, 38);
  assert.equal(output.metadata.backend, "postgres");
  assert.equal(output.metadata.namespace, "share-to-grow-repository");
  assert.equal(output.metadata.schemaVersion, 1);
  assert.equal(output.metadata.counts.ledgerEntries, 0);
  const joined = calls.map((call) => call.sql).join("\n");
  assert.match(joined, /BEGIN READ ONLY/);
  assert.match(joined, /SELECT current_setting\('transaction_read_only'\)/);
  assert.match(joined, /FROM public\.genesis_foundation_state/);
  assert.match(joined, /ROLLBACK/);
  assert.doesNotMatch(joined, /\b(UPDATE|INSERT|DELETE|TRUNCATE|ALTER|DROP|CREATE)\b/i);
});

test("fails closed when transaction is not read-only", async () => {
  const { pool } = fakePool({
    readOnly: "off",
    row: {
      schema_version: 1,
      revision: "1",
      updated_at: "2026-01-01T00:00:00.000Z",
      data: {
        participants: [],
        trackingIdentities: [],
        ruleVersions: [],
        ledgerEntries: [],
        sourceEventReceipts: [],
        processedCommerceLines: [],
        payoutEntitlements: [],
        commerceAdjustments: [],
      },
    },
  });
  await assert.rejects(
    readPostgresShareToGrowSnapshot({ pool }),
    /POSTGRES_READ_ONLY_TRANSACTION_REQUIRED/,
  );
});

test("fails closed when namespace row is missing", async () => {
  const { pool } = fakePool({ row: null, rowCount: 0 });
  await assert.rejects(
    readPostgresShareToGrowSnapshot({ pool }),
    /POSTGRES_NAMESPACE_SNAPSHOT_NOT_FOUND/,
  );
});

