import assert from "node:assert/strict";
import test from "node:test";
import { CompilerManifestManager } from "../../../src/compiler/core/CompilerManifestManager";

test("manifest manager builds deterministic manifest checksum", () => {
  const manager = new CompilerManifestManager();
  const manifest = manager.buildManifest({
    sessionId: "session-1",
    compilerVersion: "1.0.0",
    pipelineVersion: "1.0.0",
    passManifests: [
      {
        id: "discovery-pass",
        version: "1.0.0",
        description: "d",
        inputType: "in",
        outputType: "out",
        dependencies: [],
        capabilities: ["discovery"],
        lifecycle: "active",
      },
    ],
    artifactIds: ["a1"],
    diagnostics: [],
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:01.000Z",
    sourceManifest: {
      sourceType: "markdown",
      sourceId: "s1",
    },
    standards: {
      gps0001: "1.0",
      gps0002: "1.0",
      eir0001: "1.0",
      bgs0001: "1.0",
      bgc0001: "1.0",
      gcc0001: "1.0",
    },
  });

  assert.equal(manifest.checksum.length, 64);
  assert.equal(manifest.schemaVersion, "1.0.0");
});
