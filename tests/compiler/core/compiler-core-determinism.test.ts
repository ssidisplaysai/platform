import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { CompilerCore } from "../../../src/compiler/core/CompilerCore";

function fixturePath(...segments: string[]): string {
  return resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures", ...segments);
}

test("compiler core replay and deterministic output", async () => {
  const core = new CompilerCore();

  const first = await core.compile(
    {
      source: {
        id: "determinism-source",
        sourceType: "markdown",
        origin: fixturePath("sample.md"),
      },
    },
    "core-determinism-1",
  );

  const second = await core.compile(
    {
      source: {
        id: "determinism-source",
        sourceType: "markdown",
        origin: fixturePath("sample.md"),
      },
    },
    "core-determinism-2",
  );

  assert.deepEqual(first.artifacts, second.artifacts);
  assert.deepEqual(first.evidenceIR, second.evidenceIR);
});