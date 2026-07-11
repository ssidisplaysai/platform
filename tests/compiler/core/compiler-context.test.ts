import assert from "node:assert/strict";
import test from "node:test";
import { CompilerContext } from "../../../src/compiler/core/CompilerContext";

test("compiler context tracks references, state, and artifact/manifest ids", () => {
  const context = new CompilerContext(
    {
      compilerVersion: "1.0.0",
      pipelineVersion: "1.0.0",
      standards: {
        gps0001: "1.0",
        gps0002: "1.0",
        eir0001: "1.0",
        bgs0001: "1.0",
        bgc0001: "1.0",
        gcc0001: "1.0",
      },
    },
    "session-1",
  );

  context.registerReference("source", "src-1");
  context.setPassStatus("discovery-pass", "completed");
  context.registerArtifactId("artifact-1");
  context.registerManifestId("manifest-1");

  const snapshot = context.snapshotState();
  assert.equal(context.getReference("source"), "src-1");
  assert.equal(snapshot.passStatuses["discovery-pass"], "completed");
  assert.deepEqual(snapshot.artifactIds, ["artifact-1"]);
  assert.deepEqual(snapshot.manifestIds, ["manifest-1"]);
});
