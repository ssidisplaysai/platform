import assert from "node:assert/strict";
import test from "node:test";
import { CompilerValidationEngine } from "../../../src/compiler/core/CompilerValidationEngine";

test("validation engine checks pass contracts, artifacts, and manifest", () => {
  const validation = new CompilerValidationEngine();

  const passDiagnostics = validation.validatePassContracts([
    {
      id: "p1",
      version: "1.0.0",
      description: "x",
      inputType: "in",
      outputType: "out",
      dependencies: [],
      capabilities: [],
      lifecycle: "active",
    },
  ]);
  assert.equal(passDiagnostics.length, 0);

  const artifactDiagnostics = validation.validateArtifacts([
    {
      id: "a1",
      type: "t",
      version: "1.0",
      checksum: "a".repeat(64),
      createdAt: "2026-01-01T00:00:00.000Z",
      sessionId: "s",
      producedByPassId: "p1",
      inputArtifactIds: [],
      metadata: {},
    },
  ]);
  assert.equal(artifactDiagnostics.length, 0);

  const manifestDiagnostics = validation.validateManifest({
    schemaVersion: "1.0.0",
    sessionId: "s",
    compilerVersion: "1.0.0",
    pipelineVersion: "1.0.0",
    passManifests: [],
    artifactIds: [],
    diagnostics: [],
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:01.000Z",
    checksum: "b".repeat(64),
    sourceManifest: { sourceType: "markdown", sourceId: "id" },
    standards: {
      gps0001: "1.0",
      gps0002: "1.0",
      eir0001: "1.0",
      bgs0001: "1.0",
      bgc0001: "1.0",
      gcc0001: "1.0",
    },
  });
  assert.equal(manifestDiagnostics.length, 0);
});
