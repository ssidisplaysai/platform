import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphHasher } from "../../../src/compiler/evidence/EvidenceGraphHasher";
import { EvidenceValidationError, EvidenceValidator } from "../../../src/compiler/evidence/EvidenceValidator";

function validGraph(): EvidenceGraph {
  return new EvidenceGraph(
    [
      {
        id: "source:s1",
        nodeType: "source",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "source.md",
        confidence: 1,
        metadata: {},
        lineage: { sourceId: "s1", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:a1",
        nodeType: "artifact",
        sourceId: "s1",
        artifactId: "a1",
        versionId: "v1",
        sourceType: "markdown",
        origin: "source.md",
        checksum: "hash1",
        confidence: 1,
        metadata: {},
        lineage: { sourceId: "s1", parentNodeIds: ["source:s1"], transformationSteps: [] },
      },
    ],
    [
      {
        id: "rel:1",
        from: "source:s1",
        to: "artifact:a1",
        relationshipType: "produced",
        sourceId: "s1",
        metadata: {},
        lineage: { sourceId: "s1", parentRelationshipIds: [], transformationSteps: [] },
      },
    ],
  );
}

test("validator accepts a valid evidence ir", () => {
  const graph = validGraph();
  const hasher = new EvidenceGraphHasher();
  const ir = {
    schemaVersion: "1.0.0" as const,
    graph,
    artifactCount: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    deterministicHash: hasher.hashIR({
      schemaVersion: "1.0.0",
      graph,
      artifactCount: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
    }),
  };

  const validator = new EvidenceValidator();
  validator.validateIR(ir);
  assert.equal(true, true);
});

test("validator fails typed errors on invalid graph states", () => {
  const graph = new EvidenceGraph(
    [
      {
        id: "artifact:bad",
        nodeType: "artifact",
        sourceId: "s1",
        sourceType: "json",
        origin: "bad.json",
        confidence: 2,
        metadata: {},
        lineage: { sourceId: "s1", parentNodeIds: [], transformationSteps: [] },
      },
    ],
    [],
  );

  const validator = new EvidenceValidator();

  assert.throws(() => validator.validateGraph(graph), (error: unknown) => {
    return error instanceof EvidenceValidationError && error.code === "INVALID_NODE_CONFIDENCE";
  });
});
