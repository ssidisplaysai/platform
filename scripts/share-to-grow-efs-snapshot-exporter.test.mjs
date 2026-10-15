import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { readFilesystemShareToGrowSnapshot } from "./share-to-grow-efs-snapshot-exporter.mjs";

function validEnvelope() {
  return {
    schemaVersion: 1,
    revision: 26,
    updatedAt: "2026-10-13T16:33:17.833Z",
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

test("reads and validates filesystem snapshot envelope", async () => {
  const directory = await mkdtemp(join(tmpdir(), "s2g-efs-test-"));
  try {
    const path = join(directory, "share-to-grow-repository.json");
    await writeFile(path, JSON.stringify(validEnvelope()), "utf8");
    const output = await readFilesystemShareToGrowSnapshot({
      sourcePath: path,
      capturedAt: "2026-10-13T20:00:00.000Z",
    });
    assert.equal(output.metadata.backend, "filesystem");
    assert.equal(output.metadata.revision, 26);
    assert.equal(output.metadata.counts.processedCommerceLines, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects invalid envelope shapes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "s2g-efs-invalid-"));
  try {
    const path = join(directory, "share-to-grow-repository.json");
    await writeFile(path, JSON.stringify({ bad: true }), "utf8");
    await assert.rejects(
      readFilesystemShareToGrowSnapshot({ sourcePath: path }),
      /SNAPSHOT_ENVELOPE_INVALID/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("exporter implementation avoids EFS write operations", async () => {
  const source = await readFile(resolve(import.meta.dirname, "share-to-grow-efs-snapshot-exporter.mjs"), "utf8");
  assert.doesNotMatch(source, /\b(writeFile|appendFile|rm|unlink|createWriteStream)\b/);
});

