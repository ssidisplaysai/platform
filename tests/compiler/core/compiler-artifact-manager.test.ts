import assert from "node:assert/strict";
import test from "node:test";
import { CompilerArtifactManager } from "../../../src/compiler/core/CompilerArtifactManager";

test("artifact manager registers deterministic artifacts and lookup", () => {
  const manager = new CompilerArtifactManager();

  const artifact = manager.register(
    "knowledge-artifacts",
    "1.0.0",
    "session-1",
    "discovery-pass",
    { value: "x" },
    [],
    { note: "first" },
    "2026-01-01T00:00:00.000Z",
  );

  const duplicate = manager.register(
    "knowledge-artifacts",
    "1.0.0",
    "session-1",
    "discovery-pass",
    { value: "x" },
    [],
    { note: "second" },
    "2026-01-01T00:00:00.000Z",
  );

  assert.equal(artifact.id, duplicate.id);
  assert.equal(manager.list().length, 1);
  assert.equal(manager.resolve(artifact.id).producedByPassId, "discovery-pass");
});
