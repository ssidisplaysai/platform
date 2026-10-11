import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  BUSINESS_NAMESPACE,
  KNOWN_SYNTHETIC_RECEIPTS,
  restorePostgresBaselineFromCertifiedEfs,
  verifySyntheticReceiptDelta,
} from "./postgres-baseline-restore.mjs";

function fakePool({
  rowCount = 1,
  namespace = BUSINESS_NAMESPACE,
  schemaVersion = 1,
  revision = "35",
  updatedAt = "2026-10-11T13:17:40.115Z",
  canonicalText = '{"data":{"sourceEventReceipts":[{"sourceEventId":"staging-af-A-unpaid"}]}}',
  sourceEventIds = ["base-receipt", ...KNOWN_SYNTHETIC_RECEIPTS],
  updateCount = 1,
  postRevision = "24",
  postUpdatedAt = "2026-10-09T23:30:07.250Z",
  postCanonicalText = '{"data":{"sourceEventReceipts":[{"sourceEventId":"base-receipt"}]}}',
}) {
  const state = { calls: [], committed: false };
  const client = {
    async query(sql, params) {
      state.calls.push({ sql: sql.trim().split("\n")[0], params });
      if (sql === "BEGIN") return { rows: [] };
      if (sql === "COMMIT") {
        state.committed = true;
        return { rows: [] };
      }
      if (sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FOR UPDATE")) {
        return {
          rowCount: 1,
          rows: [{
            row_count: rowCount,
            namespace,
            schema_version: schemaVersion,
            revision,
            updated_at: updatedAt,
            canonical_text: canonicalText,
            source_event_ids: sourceEventIds,
          }],
        };
      }
      if (sql.trim().startsWith("UPDATE")) return { rowCount: updateCount };
      if (sql.includes("FROM public.genesis_foundation_state") && sql.includes("canonical_text")) {
        return {
          rowCount: 1,
          rows: [{
            row_count: 1,
            namespace: BUSINESS_NAMESPACE,
            schema_version: 1,
            revision: postRevision,
            updated_at: postUpdatedAt,
            canonical_text: postCanonicalText,
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {
      state.calls.push({ sql: "RELEASE" });
    },
  };
  return { pool: { connect: async () => client }, state };
}

test("verifySyntheticReceiptDelta accepts only the approved synthetic delta", () => {
  verifySyntheticReceiptDelta({
    sourceEventIds: ["base", ...KNOWN_SYNTHETIC_RECEIPTS],
    sourceEnvelopeEventIds: ["base"],
  });
  assert.throws(() => verifySyntheticReceiptDelta({
    sourceEventIds: ["base", "unknown-write"],
    sourceEnvelopeEventIds: ["base"],
  }));
});

test("restore updates exactly one row in one transaction", async () => {
  const canonicalSourceData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }] };
  const sourceCanonicalHash = createHash("sha256")
    .update('{"sourceEventReceipts":[{"sourceEventId":"base-receipt"}]}', "utf8")
    .digest("hex");
  const preCanonicalText = '{"sourceEventReceipts":[{"sourceEventId":"base-receipt"},{"sourceEventId":"staging-af-A-unpaid"},{"sourceEventId":"staging-af-B-paid"},{"sourceEventId":"staging-af-C-paid"},{"sourceEventId":"staging-af-C-cancel"},{"sourceEventId":"staging-af-D-paid"},{"sourceEventId":"staging-af-D-refund20"},{"sourceEventId":"staging-af-E-paid"},{"sourceEventId":"staging-af-E-refund20"},{"sourceEventId":"staging-af-E-refund40"},{"sourceEventId":"staging-af-F-paid"},{"sourceEventId":"staging-af-F-refund50"}]}';
  const { pool, state } = fakePool({
    canonicalText: preCanonicalText,
    postCanonicalText: '{"sourceEventReceipts":[{"sourceEventId":"base-receipt"}]}',
  });
  const result = await restorePostgresBaselineFromCertifiedEfs({
    pool,
    sourceEnvelope: {
      schemaVersion: 1,
      revision: 24,
      updatedAt: "2026-10-09T23:30:07.250Z",
      data: canonicalSourceData,
    },
    sourceCanonicalHash,
    expectedPreRestore: {
      schemaVersion: 1,
      revision: 35,
      updatedAt: "2026-10-11T13:17:40.115Z",
      canonicalHash: createHash("sha256").update(preCanonicalText, "utf8").digest("hex"),
    },
  });

  assert.equal(result.rowsUpdated, 1);
  assert.equal(result.after.revision, 24);
  assert.ok(state.committed);
  assert.equal(state.calls[0].sql, "BEGIN");
  const updateCall = state.calls.find(({ sql }) => sql.startsWith("UPDATE public.genesis_foundation_state"));
  assert.ok(updateCall);
  assert.equal(updateCall.params[0], BUSINESS_NAMESPACE);
});

test("restore rolls back on precheck mismatch", async () => {
  const { pool, state } = fakePool({ revision: "36" });
  await assert.rejects(
    restorePostgresBaselineFromCertifiedEfs({
      pool,
      sourceEnvelope: {
        schemaVersion: 1,
        revision: 24,
        updatedAt: "2026-10-09T23:30:07.250Z",
        data: { sourceEventReceipts: [] },
      },
      sourceCanonicalHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed0c8f6f9f6f9f6f9f6f9f6f9f6f9f6f",
      expectedPreRestore: {
        schemaVersion: 1,
        revision: 35,
        updatedAt: "2026-10-11T13:17:40.115Z",
        canonicalHash: "abc",
      },
    }),
  );
  assert.ok(state.calls.some(({ sql }) => sql === "ROLLBACK"));
  assert.ok(!state.committed);
});

test("restore SQL is scoped to one exact namespace", async () => {
  const source = await readFile(resolve(import.meta.dirname, "postgres-baseline-restore.mjs"), "utf8");
  assert.match(source, /WHERE namespace = \$1[\s\S]*schema_version = \$6[\s\S]*revision = \$7[\s\S]*updated_at = \$8::timestamptz/);
  assert.doesNotMatch(source, /\bTRUNCATE\b|\bDROP\b|\bDELETE FROM\b/i);
});

test("runner restore mode exists and returns before certification writes", async () => {
  const source = await readFile(resolve(import.meta.dirname, "staging-postgres-certification.mjs"), "utf8");
  const restoreBranch = source.indexOf('process.argv[2] === "--restore-postgres-from-certified-efs"');
  assert.notEqual(restoreBranch, -1);
  assert.ok(restoreBranch < source.indexOf("await provisionApplicationRole(config)"));
  assert.ok(restoreBranch < source.indexOf('["scripts/migrate-foundation-state.mjs", "up"]'));
  assert.match(source.slice(restoreBranch, restoreBranch + 400), /await restoreBusinessBaselineFromCertifiedEfs\(config\);\s*return;/);
});
