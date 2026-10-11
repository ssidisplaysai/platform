import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateFoundationStateEnvelope } from "../../../scripts/foundation-state-envelope.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");

function emptyEnvelope() {
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: "2026-10-10T00:00:00.000Z",
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
}

test("validates schema version and inventories all expected collections", () => {
  const envelope = emptyEnvelope();
  envelope.data.participants.push({ participantId: "participant-1" });
  assert.deepEqual(validateFoundationStateEnvelope(envelope), {
    participants: 1,
    trackingIdentities: 0,
    ruleVersions: 0,
    ledgerEntries: 0,
    sourceEventReceipts: 0,
    processedCommerceLines: 0,
    payoutEntitlements: 0,
    commerceAdjustments: 0,
  });
});

test("rejects invalid envelope metadata and missing collections", () => {
  const invalidSchema = emptyEnvelope();
  invalidSchema.schemaVersion = 2;
  assert.throws(() => validateFoundationStateEnvelope(invalidSchema), /unsupported schema/);

  const missingCollection = emptyEnvelope();
  delete missingCollection.data.ledgerEntries;
  assert.throws(() => validateFoundationStateEnvelope(missingCollection), /missing one or more required collections/);
});

for (const [collection, records] of [
  ["participants", [{ participantId: "same" }, { participantId: "same" }]],
  ["ledgerEntries", [{ id: "one", idempotencyKey: "same" }, { id: "two", idempotencyKey: "same" }]],
  ["sourceEventReceipts", [{ sourceEventId: "same" }, { sourceEventId: "same" }]],
]) {
  test(`rejects duplicate canonical identifiers in ${collection}`, () => {
    const envelope = emptyEnvelope();
    envelope.data[collection] = records;
    assert.throws(() => validateFoundationStateEnvelope(envelope), /duplicate/);
  });
}

test("rejects malformed collection records and missing canonical identifiers", () => {
  const malformed = emptyEnvelope();
  malformed.data.participants = [null];
  assert.throws(() => validateFoundationStateEnvelope(malformed), /malformed record/);

  const missingIdentifier = emptyEnvelope();
  missingIdentifier.data.participants = [{}];
  assert.throws(() => validateFoundationStateEnvelope(missingIdentifier), /without participantId/);
});

test("import dry-run rejects malformed and duplicate source envelopes before database access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "foundation-import-validation-"));
  const sourcePath = join(directory, "source.json");
  const baseEnvironment = {
    ...process.env,
    GENESIS_ENVIRONMENT: "staging",
    GENESIS_STAGING_DATABASE_HOST: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com",
    GENESIS_STAGING_DATABASE_NAME: "genesis_staging",
    DB_HOST: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com",
    DB_PORT: "5432",
    DB_NAME: "genesis_staging",
    DB_USERNAME: "genesis_app",
    DB_PASSWORD: "not-a-real-secret",
  };

  try {
    const malformed = emptyEnvelope();
    delete malformed.data.sourceEventReceipts;
    await writeFile(sourcePath, JSON.stringify(malformed));
    const malformedResult = spawnSync(process.execPath, [
      resolve(repoRoot, "scripts/import-foundation-state.mjs"),
      "--source", sourcePath,
      "--namespace", "certification-validation",
      "--dry-run",
    ], { cwd: repoRoot, env: baseEnvironment, encoding: "utf8", windowsHide: true });
    assert.notEqual(malformedResult.status, 0);
    assert.match(malformedResult.stderr, /missing one or more required collections/);
    assert.ok(!malformedResult.stderr.includes(baseEnvironment.DB_PASSWORD));

    const duplicate = emptyEnvelope();
    duplicate.data.participants = [
      { participantId: "duplicate-id" },
      { participantId: "duplicate-id" },
    ];
    await writeFile(sourcePath, JSON.stringify(duplicate));
    const duplicateResult = spawnSync(process.execPath, [
      resolve(repoRoot, "scripts/import-foundation-state.mjs"),
      "--source", sourcePath,
      "--namespace", "certification-validation",
      "--dry-run",
    ], { cwd: repoRoot, env: baseEnvironment, encoding: "utf8", windowsHide: true });
    assert.notEqual(duplicateResult.status, 0);
    assert.match(duplicateResult.stderr, /duplicate participantId/);
    assert.ok(!duplicateResult.stderr.includes(baseEnvironment.DB_PASSWORD));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
