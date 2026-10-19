import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  boundOutput,
  formatChildFailureOutput,
  redactOutput,
  secretValues,
} from "./postgres-child-output.mjs";
import { classifyNamespace, inventoryFoundationRows, ROW_INVENTORY_QUERY } from "./postgres-adapter-diagnostic.mjs";

const read = (...parts) => readFile(resolve(import.meta.dirname, "..", ...parts), "utf8");

test("failure output is framed, redacted, and bounded", () => {
  const environment = { DB_PASSWORD: "s3cret-pass", DB_ADMIN_PASSWORD: "adm1n-pass", DB_HOST: "host" };
  const result = {
    stdout: `fail s3cret-pass password=hunter2 postgres://u:adm1n-pass@h/db ${"x".repeat(50_000)}`,
    stderr: "boom",
  };
  const text = formatChildFailureOutput("LABEL", result, environment, 1_000);
  for (const marker of ["LABEL_STDOUT_BEGIN", "LABEL_STDOUT_END", "LABEL_STDERR_BEGIN", "LABEL_STDERR_END"]) {
    assert.ok(text.includes(marker), marker);
  }
  assert.ok(!text.includes("s3cret-pass"));
  assert.ok(!text.includes("adm1n-pass"));
  assert.ok(!text.includes("hunter2"));
  assert.match(text, /truncated/);
  assert.ok(text.length < 1_500);
  assert.deepEqual(secretValues(environment).sort(), ["adm1n-pass", "s3cret-pass"]);
  assert.equal(boundOutput("short", 10), "short");
  assert.equal(redactOutput(undefined, []), "");
});

test("runner emits child output on failure and keeps the failure unchanged", async () => {
  const source = await read("scripts", "staging-postgres-certification.mjs");
  assert.match(source, /console\.error\(formatChildFailureOutput\(label, result, environment\)\);\s*fail\(`\$\{label\} failed \(\$\{code\}\)`\);/);
});

test("integration and concurrency are separate invocations with distinct markers", async () => {
  const source = await read("scripts", "staging-postgres-certification.mjs");
  assert.match(source, /runLiveAdapterTest\("POSTGRES_LIVE_INTEGRATION", "POSTGRES_LIVE_INTEGRATION"\)/);
  assert.match(source, /runLiveAdapterTest\("POSTGRES_CONCURRENCY_CERTIFICATION", "POSTGRES_CONCURRENCY_CERTIFICATION"\)/);
  assert.match(source, /console\.log\(`\$\{label\}=PASS`\)/);
  const live = await read("src", "modules", "foundation", "__tests__", "postgres-foundation-state-store.live.test.ts");
  assert.match(live, /test\("POSTGRES_LIVE_INTEGRATION /);
  assert.match(live, /test\("POSTGRES_CONCURRENCY_CERTIFICATION /);
});

test("live tests use dedicated namespaces, the RDS CA, and owned-only cleanup", async () => {
  const live = await read("src", "modules", "foundation", "__tests__", "postgres-foundation-state-store.live.test.ts");
  assert.match(live, /`certification-integration-\$\{randomUUID\(\)\}`/);
  assert.match(live, /`certification-concurrency-\$\{randomUUID\(\)\}`/);
  assert.match(live, /namespace !== BUSINESS_NAMESPACE/);
  assert.match(live, /ownedNamespaces\.filter\(isOwnedCertificationNamespace\)/);
  assert.match(live, /GENESIS_RDS_CA_CERT/);
  assert.doesNotMatch(live, /rejectUnauthorized: false/);
  assert.doesNotMatch(live, /TRUNCATE|DROP TABLE|DELETE FROM public\.genesis_foundation_state\s*"/i);
  const deletes = live.match(/DELETE FROM[^"`]*/g) ?? [];
  assert.equal(deletes.length, 1);
  assert.match(deletes[0], /WHERE namespace = ANY/);
});

test("adapter diagnostic mode runs only connection, live tests, and read-only inventory", async () => {
  const source = await read("scripts", "staging-postgres-certification.mjs");
  const start = source.indexOf("async function diagnoseAdapter");
  const body = source.slice(start, source.indexOf("function canonicalJson", start));
  assert.doesNotMatch(body, /provisionApplicationRole|migrate-foundation-state|import-foundation-state|verifyEfsSource|runLiveAdapterTests\(/);
  const branch = source.indexOf('process.argv[2] === "--diagnose-adapter"');
  assert.notEqual(branch, -1);
  assert.ok(branch < source.indexOf("const sourcePath = process.env.POSTGRES_CERTIFICATION_SOURCE"));
  assert.ok(branch < source.indexOf("await provisionApplicationRole(config)"));
  assert.ok(branch < source.indexOf("await verifyEfsSource(sourcePath)"));
  assert.match(source.slice(branch, branch + 400), /await diagnoseAdapter\(config\);[\s\S]*return;/);
});

test("namespace classification protects business data and the inventory is read-only", async () => {
  assert.equal(classifyNamespace("share-to-grow-repository"), "BUSINESS_NAMESPACE");
  assert.equal(classifyNamespace("certification-integration-abc"), "CERTIFICATION_TEST_NAMESPACE");
  assert.equal(classifyNamespace("staging-certification:abc"), "CERTIFICATION_TEST_NAMESPACE");
  assert.equal(classifyNamespace("other"), "UNKNOWN");
  assert.doesNotMatch(ROW_INVENTORY_QUERY, /(?:SELECT|,)\s*data\s*(?:,|FROM)/i);
  assert.match(ROW_INVENTORY_QUERY, /jsonb_typeof\(data\) = 'object'/);

  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith("SELECT current_setting")) return { rows: [{ transaction_read_only: "on" }] };
      if (sql === ROW_INVENTORY_QUERY) {
        return { rows: [{ namespace: "share-to-grow-repository", schema_version: 1, revision: "1", updated_at: "2026-01-01T00:00:00Z", data_is_object: true }] };
      }
      return { rows: [] };
    },
    release() {
      calls.push("RELEASE");
    },
  };
  const rows = await inventoryFoundationRows({ connect: async () => client });
  assert.equal(rows[0].classification, "BUSINESS_NAMESPACE");
  assert.deepEqual(Object.keys(rows[0]).sort(), ["classification", "data_is_object", "namespace", "revision", "schema_version", "updated_at"]);
  assert.equal(calls[0], "BEGIN READ ONLY");
  assert.equal(calls.at(-2), "ROLLBACK");
  assert.doesNotMatch(calls.join("\n"), /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
});
