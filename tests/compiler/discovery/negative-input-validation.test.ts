import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { DiscoveryEngine } from "../../../src/compiler/discovery/DiscoveryEngine";
import { DiscoveryError } from "../../../src/compiler/discovery/DiscoveryError";
import type { KnowledgeSource } from "../../../src/compiler/discovery/KnowledgeSource";

const fixtureRoot = resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures");

function fixturePath(...segments: string[]): string {
  return resolve(fixtureRoot, ...segments);
}

async function expectDiscoveryError(
  source: KnowledgeSource,
  expectedCode: DiscoveryError["code"],
): Promise<void> {
  const engine = new DiscoveryEngine();

  try {
    await engine.ingest(source);
    assert.fail(`Expected discovery error ${expectedCode}`);
  } catch (error) {
    assert.equal(error instanceof DiscoveryError, true);
    assert.equal((error as DiscoveryError).code, expectedCode);
  }
}

test("malformed JSON fails with typed parse error", async () => {
  await expectDiscoveryError(
    {
      id: "bad-json",
      sourceType: "json",
      origin: fixturePath("malformed.json"),
    },
    "PARSE_ERROR",
  );
});

test("malformed YAML fails with typed parse error", async () => {
  await expectDiscoveryError(
    {
      id: "bad-yaml",
      sourceType: "yaml",
      origin: fixturePath("malformed.yaml"),
    },
    "PARSE_ERROR",
  );
});

test("missing file/path fails with typed missing source error", async () => {
  await expectDiscoveryError(
    {
      id: "missing-md",
      sourceType: "markdown",
      origin: fixturePath("missing.md"),
    },
    "MISSING_SOURCE",
  );

  await expectDiscoveryError(
    {
      id: "missing-fs",
      sourceType: "filesystem",
      origin: fixturePath("missing-folder"),
    },
    "MISSING_SOURCE",
  );
});

test("empty file ingests successfully and deterministically", async () => {
  const engine = new DiscoveryEngine();
  const source: KnowledgeSource = {
    id: "empty-md",
    sourceType: "markdown",
    origin: fixturePath("empty.md"),
  };

  const result = await engine.ingest(source);
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]?.content, "");
  assert.ok(result.evidenceIR.deterministicHash);
});

test("unsupported source type fails with typed plugin-not-registered error", async () => {
  const source = {
    id: "unsupported",
    sourceType: "unsupported",
    origin: fixturePath("sample.md"),
  } as unknown as KnowledgeSource;

  await expectDiscoveryError(source, "PLUGIN_NOT_REGISTERED");
});
