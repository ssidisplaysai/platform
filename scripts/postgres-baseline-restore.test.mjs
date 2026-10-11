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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashCanonical(value) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function hashRaw(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function fakePool({
  rowCount = 1,
  namespace = BUSINESS_NAMESPACE,
  schemaVersion = 1,
  revision = "35",
  updatedAt = "2026-10-11T13:17:40.115Z",
  canonicalText = '{"sourceEventReceipts":[{"sourceEventId":"base-receipt"}]}',
  sourceEventIds = ["base-receipt", ...KNOWN_SYNTHETIC_RECEIPTS],
  updateCount = 1,
  postRevision = "24",
  postUpdatedAt = "2026-10-09T23:30:07.250Z",
  postCanonicalText = '{"sourceEventReceipts":[{"sourceEventId":"base-receipt"}]}',
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
            updated_at_raw: updatedAt,
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

function restoreInput({
  sourceData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }] },
  preData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))] },
}) {
  return {
    sourceEnvelope: {
      schemaVersion: 1,
      revision: 24,
      updatedAt: "2026-10-09T23:30:07.250Z",
      data: sourceData,
    },
    sourceCanonicalHash: hashCanonical(sourceData),
    expectedPreRestore: {
      schemaVersion: 1,
      revision: 35,
      updatedAt: "2026-10-11T13:17:40.115Z",
      canonicalHash: hashCanonical(preData),
    },
  };
}

test("root cause proof: raw JSON text hash differs while semantic canonical hash matches", () => {
  const semantic = { a: 1, b: { x: 2, y: 3 } };
  const pgText = "{\"b\":{\"y\":3,\"x\":2},\"a\":1}";
  const expected = hashCanonical(semantic);
  assert.notEqual(hashRaw(pgText), expected);
  assert.equal(hashCanonical(JSON.parse(pgText)), expected);
});

test("verifySyntheticReceiptDelta accepts only approved synthetic delta", () => {
  verifySyntheticReceiptDelta({
    sourceEventIds: ["base", ...KNOWN_SYNTHETIC_RECEIPTS],
    sourceEnvelopeEventIds: ["base"],
  });
  assert.throws(() => verifySyntheticReceiptDelta({
    sourceEventIds: ["base", "unknown-write"],
    sourceEnvelopeEventIds: ["base"],
  }));
});

test("PRECHECK accepts semantically equal JSON with different property ordering", async () => {
  const sourceData = { a: 1, b: { x: 2, y: 3 }, sourceEventReceipts: [{ sourceEventId: "base-receipt" }] };
  const preData = { a: 1, b: { x: 2, y: 3 }, sourceEventReceipts: [{ sourceEventId: "base-receipt" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))] };
  const preText = "{\"sourceEventReceipts\":[{\"sourceEventId\":\"base-receipt\"},{\"sourceEventId\":\"staging-af-A-unpaid\"},{\"sourceEventId\":\"staging-af-B-paid\"},{\"sourceEventId\":\"staging-af-C-paid\"},{\"sourceEventId\":\"staging-af-C-cancel\"},{\"sourceEventId\":\"staging-af-D-paid\"},{\"sourceEventId\":\"staging-af-D-refund20\"},{\"sourceEventId\":\"staging-af-E-paid\"},{\"sourceEventId\":\"staging-af-E-refund20\"},{\"sourceEventId\":\"staging-af-E-refund40\"},{\"sourceEventId\":\"staging-af-F-paid\"},{\"sourceEventId\":\"staging-af-F-refund50\"}],\"b\":{\"y\":3,\"x\":2},\"a\":1}";
  const postText = "{\"b\":{\"x\":2,\"y\":3},\"a\":1,\"sourceEventReceipts\":[{\"sourceEventId\":\"base-receipt\"}]}";
  const { pool } = fakePool({ canonicalText: preText, postCanonicalText: postText });
  const result = await restorePostgresBaselineFromCertifiedEfs({
    ...restoreInput({ sourceData, preData }),
    pool,
  });
  assert.equal(result.rowsUpdated, 1);
});

test("PRECHECK rejects actual semantic data differences", async () => {
  const sourceData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }] };
  const preDataExpected = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))] };
  const preDataActual = { sourceEventReceipts: [{ sourceEventId: "DIFFERENT-base" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))] };
  const { pool, state } = fakePool({ canonicalText: JSON.stringify(preDataActual) });
  await assert.rejects(
    restorePostgresBaselineFromCertifiedEfs({
      ...restoreInput({ sourceData, preData: preDataExpected }),
      pool,
    }),
    /canonical hash differs/,
  );
  const updateCall = state.calls.find(({ sql }) => sql.startsWith("UPDATE public.genesis_foundation_state"));
  assert.equal(updateCall, undefined);
});

test("POSTCHECK accepts semantically equal JSONB serialization", async () => {
  const sourceData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }], nested: { a: 1, b: 2 } };
  const preData = {
    sourceEventReceipts: [{ sourceEventId: "base-receipt" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))],
    nested: { a: 1, b: 2 },
  };
  const preText = JSON.stringify({ nested: { b: 2, a: 1 }, sourceEventReceipts: preData.sourceEventReceipts });
  const postText = "{\"nested\":{\"b\":2,\"a\":1},\"sourceEventReceipts\":[{\"sourceEventId\":\"base-receipt\"}]}";
  const { pool } = fakePool({ canonicalText: preText, postCanonicalText: postText });
  const result = await restorePostgresBaselineFromCertifiedEfs({
    ...restoreInput({ sourceData, preData }),
    pool,
  });
  assert.equal(result.after.revision, 24);
});

test("POSTCHECK rejects actual data differences", async () => {
  const sourceData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }] };
  const preData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))] };
  const { pool, state } = fakePool({
    canonicalText: JSON.stringify(preData),
    postCanonicalText: '{"sourceEventReceipts":[{"sourceEventId":"DIFFERENT"}]}',
  });
  await assert.rejects(
    restorePostgresBaselineFromCertifiedEfs({
      ...restoreInput({ sourceData, preData }),
      pool,
    }),
    /postcheck failed: canonical hash mismatch/,
  );
  assert.ok(state.calls.some(({ sql }) => sql === "ROLLBACK"));
});

test("transaction begins before precheck row lock", async () => {
  const sourceData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }] };
  const preData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))] };
  const { pool, state } = fakePool({
    canonicalText: JSON.stringify(preData),
    postCanonicalText: JSON.stringify(sourceData),
  });
  await restorePostgresBaselineFromCertifiedEfs({
    ...restoreInput({ sourceData, preData }),
    pool,
  });
  const beginIndex = state.calls.findIndex(({ sql }) => sql === "BEGIN");
  const lockIndex = state.calls.findIndex(({ sql }) => sql.startsWith("SELECT"));
  assert.ok(beginIndex >= 0 && lockIndex > beginIndex);
});

test("failed precheck rolls back with no UPDATE", async () => {
  const sourceData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }] };
  const preDataExpected = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))] };
  const { pool, state } = fakePool({ revision: "36" });
  await assert.rejects(
    restorePostgresBaselineFromCertifiedEfs({
      ...restoreInput({ sourceData, preData: preDataExpected }),
      pool,
    }),
  );
  assert.ok(state.calls.some(({ sql }) => sql === "ROLLBACK"));
  assert.ok(!state.calls.some(({ sql }) => sql.startsWith("UPDATE public.genesis_foundation_state")));
});

test("successful path updates exactly one row and commits only after postcheck", async () => {
  const sourceData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }] };
  const preData = { sourceEventReceipts: [{ sourceEventId: "base-receipt" }, ...KNOWN_SYNTHETIC_RECEIPTS.map((id) => ({ sourceEventId: id }))] };
  const { pool, state } = fakePool({
    canonicalText: JSON.stringify(preData),
    postCanonicalText: JSON.stringify(sourceData),
  });
  const result = await restorePostgresBaselineFromCertifiedEfs({
    ...restoreInput({ sourceData, preData }),
    pool,
  });
  assert.equal(result.rowsUpdated, 1);
  const updates = state.calls.filter(({ sql }) => sql.startsWith("UPDATE public.genesis_foundation_state"));
  assert.equal(updates.length, 1);
  const postcheckIndex = state.calls.findIndex(({ sql }) => sql.startsWith("SELECT"));
  const commitIndex = state.calls.findIndex(({ sql }) => sql === "COMMIT");
  assert.ok(commitIndex > postcheckIndex);
});

test("restore helper never writes to EFS", async () => {
  const source = await readFile(resolve(import.meta.dirname, "postgres-baseline-restore.mjs"), "utf8");
  assert.doesNotMatch(source, /\bwriteFile|appendFile|truncate|chmod|chown|rename|rm\b/);
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
