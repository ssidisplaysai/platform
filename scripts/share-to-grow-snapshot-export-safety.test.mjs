import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");

async function read(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

test("snapshot export path includes no database mutation SQL", async () => {
  const source = await read("scripts/share-to-grow-postgres-snapshot-exporter.mjs");
  assert.doesNotMatch(source, /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE)\b/i);
  assert.match(source, /BEGIN READ ONLY/);
  assert.match(source, /ROLLBACK/);
});

test("snapshot export path includes no EFS mutation operations", async () => {
  const source = await read("scripts/share-to-grow-efs-snapshot-exporter.mjs");
  assert.match(source, /readFile/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|rm|unlink|rename)\b/);
});

test("snapshot export CLI logs only sanitized metadata", async () => {
  const source = await read("scripts/share-to-grow-snapshot-export.mjs");
  assert.match(source, /buildSanitizedExportReport/);
  assert.doesNotMatch(source, /console\.log\(([^)]*rawText|[^)]*envelope\.data)/);
});

